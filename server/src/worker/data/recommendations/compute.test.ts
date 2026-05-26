/**
 * Regression tests for commit 10fe96b — "don't show reason when obvious
 * in recommendations".
 *
 * The fix lives in three signal modules:
 *   - api/recommendations/signals/cafe-specific/popular.ts
 *   - api/recommendations/signals/cafe-specific/hidden-gems.ts  (unchanged
 *     — hidden-gems still attaches a contextual "Similar to <seed>" reason)
 *   - api/recommendations/signals/user-specific/try-something-different.ts
 *
 * Each of those passes `undefined /*reason*\/` as the 3rd argument to
 * `toRecommendationItem(...)`. The overview route then backfills missing
 * reasons via `getDefaultReasonForSectionType(sectionType)`, producing the
 * "obvious" string ("Highly rated", "Try something different") at display
 * time.
 *
 * These tests drive the signal functions themselves (not just the helpers
 * the original test file exercised) so that a regression which puts a
 * per-item reason back in popular / try-something-different is caught:
 *
 *   - `getPopularItems` is driven end-to-end against a real DB seeded by
 *     createIntegrationTestContext. Reviews are persisted via the
 *     production ReviewStorageClient, the in-memory header cache picks
 *     them up via the same `reviewDirty` event production uses, and the
 *     signal's `IRecommendationContext.getAllMenuItems()` returns
 *     hand-built candidates wrapping the seeded items.
 *
 *   - `getHiddenGems` and `getTrySomethingDifferent` need vector-thread
 *     responses. Rather than spin up real embeddings (which would require
 *     full menu sync + worker drain), we stub `SEARCH_THREAD_HANDLER.sendRequest`
 *     to return canned vector results, then run the signal end-to-end.
 *     The fix point (`undefined /*reason*\/` passed to toRecommendationItem
 *     inside try-something-different.ts) is still exercised exactly as in
 *     production.
 */

import { after, before, beforeEach, mock, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { IMenuItemBase } from '@msdining/common/models/cafe';
import { RecommendationSectionType } from '@msdining/common/models/recommendation';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import { usePrismaWrite } from '../storage/client.js';
import { ReviewStorageClient } from '../storage/clients/review/review.js';
import { SEARCH_THREAD_HANDLER } from '../threads/search.js';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../../../tests/test-server/integration-test-context.js';
import {
    IMenuItemCandidate,
    getDefaultReasonForSectionType,
} from '../../../shared/util/recommendation.js';
import { IRecommendationContext, IUserRecommendationContext } from './shared.js';
import { getPopularItems } from './signals/cafe-specific/popular.js';
import { getHiddenGems } from './signals/cafe-specific/hidden-gems.js';
import { getTrySomethingDifferent } from './signals/user-specific/try-something-different.js';

let ctx: IntegrationTestContext;

const TEST_CAFE_ID = 'rec-test-cafe';
const TEST_STATION_ID = 'rec-test-station';
const TODAY = '2026-05-13';
const HOMEPAGE_IDS: string[] = [];

before(async () => {
    ctx = await createIntegrationTestContext();
});

after(async () => {
    // Yield long enough for worker threads to drain before teardown.
    await new Promise(resolve => setTimeout(resolve, 1000));
    await ctx.cleanup();
});

beforeEach(async () => {
    // Seeded cafe → cascades stations, menu items, reviews.
    await usePrismaWrite(c => c.cafe.deleteMany({}));
    await usePrismaWrite(c => c.user.deleteMany({}));
});

// ─── Helpers ────────────────────────────────────────────────────────────────

const seedCafe = (id: string = TEST_CAFE_ID) =>
    usePrismaWrite(c => c.cafe.create({
        data: {
            id,
            name:             id,
            tenantId:         't-' + id,
            contextId:        'ctx-' + id,
            displayProfileId: 'dp-' + id,
            storeId:          's-' + id,
            externalName:     id,
            logoName:         null,
        },
    }));

const seedStation = (cafeId: string, id: string = TEST_STATION_ID, name: string = 'Grill') =>
    usePrismaWrite(c => c.station.create({
        data: {
            id,
            cafeId,
            name,
            normalizedName: normalizeNameForSearch(name),
            menuId:         'menu-' + id,
            logoUrl:        null,
            groupId:        null,
        },
    }));

interface SeedItemArgs {
    id: string;
    name: string;
    cafeId?: string;
    stationId?: string;
    price?: number;
}

const seedMenuItem = async ({ id, name, cafeId = TEST_CAFE_ID, stationId = TEST_STATION_ID, price = 7.5 }: SeedItemArgs): Promise<IMenuItemBase> => {
    await usePrismaWrite(c => c.menuItem.create({
        data: {
            id,
            cafeId,
            stationId,
            name,
            normalizedName: normalizeNameForSearch(name),
            description:    null,
            imageUrl:       null,
            tags:           null,
            calories:       600,
            maxCalories:    600,
            price,
        },
    }));
    return {
        id,
        name,
        cafeId,
        stationId,
        price,
        calories:     600,
        maxCalories:  600,
        hasThumbnail: false,
        modifiers:    [],
        tags:         new Set(),
        searchTags:   new Set(),
    };
};

const seedUser = async (id: string = 'rec-test-user'): Promise<string> => {
    await usePrismaWrite(c => c.user.create({
        data: {
            id,
            externalId:  'ext-' + id,
            provider:    'test',
            displayName: id,
        },
    }));
    return id;
};

const seedReview = async (userId: string | undefined, menuItem: IMenuItemBase, rating: number) => {
    await ReviewStorageClient.createMenuItemReviewAsync({
        menuItemId:     menuItem.id,
        userId,
        displayName:    userId ?? 'anon',
        rating,
        normalizedName: normalizeNameForSearch(menuItem.name),
        groupId:        null,
    });
};

const toCandidate = (menuItem: IMenuItemBase, cafeName = TEST_CAFE_ID, stationName = 'Grill'): IMenuItemCandidate => ({
    menuItem,
    cafeId:   menuItem.cafeId,
    cafeName,
    stationName,
});

const buildCafeContext = (items: IMenuItemCandidate[], cafeId: string = TEST_CAFE_ID): IRecommendationContext => ({
    userId:          null,
    dateString:      TODAY,
    homepageIds:     HOMEPAGE_IDS,
    cafeId,
    getAllMenuItems: async () => items,
});

const buildUserContext = (items: IMenuItemCandidate[], userId: string): IUserRecommendationContext => ({
    userId,
    dateString:      TODAY,
    seed:            `${TODAY}:${userId}`,
    getAllMenuItems: async () => items,
});

// Helper to stub SEARCH_THREAD_HANDLER.sendRequest with a per-method router.
// Returns a restore fn. Used for HG and TSD where we don't want to spin up
// real embeddings (that'd require a full sync + embeddings-queue drain).
//
// SEARCH_THREAD_HANDLER now uses the nested-service shape: sendRequest takes
// (serviceName, methodName, data). All search-worker methods live under
// service 'search', so we ignore serviceName and key the stub by methodName.
type CommandStub = (data: unknown) => unknown | Promise<unknown>;
const stubSearchThreadHandler = (handlers: Record<string, CommandStub>): (() => void) => {
    // node:test's mock.method handles the typing — restore unwinds the patch
    // even if a test throws between setup and assertion.
    const tracker = mock.method(SEARCH_THREAD_HANDLER, 'sendRequest', async (_serviceName: string, methodName: string, data: unknown) => {
        const handler = handlers[methodName];
        if (!handler) {
            throw new Error(`stubSearchThreadHandler: no stub registered for method "${methodName}"`);
        }
        return handler(data);
    });
    return () => tracker.mock.restore();
};

// ─── Section default reason contract — the obvious-section mappings ────────

test('getDefaultReasonForSectionType returns the "obvious" string the popular signal omits', () => {
    // Popular signal passes `undefined` for reason; the overview route
    // backfills with this default. If a regression changed this string,
    // popular items would display a different reason than the signal expects.
    assert.equal(
        getDefaultReasonForSectionType(RecommendationSectionType.popular),
        'Highly rated',
    );
});

test('getDefaultReasonForSectionType returns the "obvious" string trySomethingDifferent omits', () => {
    assert.equal(
        getDefaultReasonForSectionType(RecommendationSectionType.trySomethingDifferent),
        'Try something different',
    );
});

// ─── getPopularItems end-to-end (real DB, no vector worker needed) ─────────

test('getPopularItems: every returned item has reason === undefined (regression for 10fe96b)', async () => {
    await seedCafe();
    await seedStation(TEST_CAFE_ID);
    const burger = await seedMenuItem({ id: 'mi-burger', name: 'Cheeseburger' });
    const wrap = await seedMenuItem({ id: 'mi-wrap', name: 'Veggie Wrap' });
    const salad = await seedMenuItem({ id: 'mi-salad', name: 'Caesar Salad' });

    // Seed enough reviews that all items have totalReviewCount > 0 (popular
    // skips zero-review items at popular.ts:39).
    await seedReview(await seedUser('u-1'), burger, 9);
    await seedReview(await seedUser('u-2'), wrap, 8);
    await seedReview(await seedUser('u-3'), salad, 7);

    const items = [burger, wrap, salad].map(item => toCandidate(item));
    const section = await getPopularItems(buildCafeContext(items));

    assert.ok(section, 'popular section must be produced for items with reviews');
    assert.equal(section.type, RecommendationSectionType.popular);
    assert.ok(section.items.length > 0, 'expected at least one popular item');

    for (const item of section.items) {
        assert.equal(
            item.reason,
            undefined,
            `popular item ${item.name} must omit reason (the section header conveys it)`,
        );
    }
});

test('getPopularItems: review header data is attached even though reason stays undefined', async () => {
    await seedCafe();
    await seedStation(TEST_CAFE_ID);
    const item = await seedMenuItem({ id: 'mi-h-1', name: 'Famous Burger' });

    await seedReview(await seedUser('u-h-1'), item, 9);
    await seedReview(await seedUser('u-h-2'), item, 10);
    await seedReview(await seedUser('u-h-3'), item, 8);

    const section = await getPopularItems(buildCafeContext([toCandidate(item)]));
    assert.ok(section);
    const [recommended] = section.items;
    assert.ok(recommended, 'expected popular recommendation');

    // The header is attached (so the UI can show the rating badge) but
    // reason is intentionally omitted (the fix).
    assert.equal(recommended.reason, undefined);
    assert.ok(recommended.overallRating != null && recommended.overallRating > 0,
        `expected overallRating to be attached, got ${recommended.overallRating}`);
    // NOTE: review headers are propagated to the in-memory cache via the
    // STORAGE_EVENTS 'reviewDirty' event. The current implementation fires
    // synchronously, so the count reflects the seeded reviews immediately.
    // If review header propagation ever becomes async/batched, this
    // assertion will start failing as a timing flake — not as a regression
    // for the fix this test targets. Add an explicit sync point if so.
    assert.equal(recommended.totalReviewCount, 3,
        'review count must reflect the three reviews seeded above');
});

// ─── getTrySomethingDifferent — drive signal with stubbed vector helpers ────

test('getTrySomethingDifferent: every returned item has reason === undefined (regression for 10fe96b)', async () => {
    await seedCafe();
    await seedStation(TEST_CAFE_ID);
    const reviewedItem = await seedMenuItem({ id: 'mi-tsd-reviewed', name: 'Boring Salad' });
    const candidateA = await seedMenuItem({ id: 'mi-tsd-a', name: 'Spicy Ramen' });
    const candidateB = await seedMenuItem({ id: 'mi-tsd-b', name: 'Korean BBQ' });

    const userId = await seedUser('u-tsd');
    // User has reviewed the boring salad — TSD uses this as the centroid.
    await seedReview(userId, reviewedItem, 5);

    const restore = stubSearchThreadHandler({
        // Candidate IDs that the centroid search "found" — both unreviewed.
        computeCentroidSearch: () => [
            { id: 'mi-tsd-a', distance: 0.8 },
            { id: 'mi-tsd-b', distance: 0.6 },
        ],
        // No negative reviews → this won't be called in practice, but include
        // a defensive default in case the signal evolves.
        computeNegativePenalties: () => [],
    });

    try {
        const items = [reviewedItem, candidateA, candidateB].map(i => toCandidate(i));
        const section = await getTrySomethingDifferent(
            buildUserContext(items, userId),
            async () => ReviewStorageClient.getReviewsForUserAsync({ userId }),
        );

        assert.ok(section, 'try-something-different section must be produced');
        assert.equal(section.type, RecommendationSectionType.trySomethingDifferent);
        assert.ok(section.items.length > 0, 'expected at least one unreviewed candidate');
        for (const item of section.items) {
            assert.equal(
                item.reason,
                undefined,
                `try-something-different item ${item.name} must omit reason`,
            );
            // The user's reviewed item must NOT appear in the result.
            assert.notEqual(item.menuItemId, 'mi-tsd-reviewed',
                'TSD must filter out items the user has already reviewed');
        }
    } finally {
        restore();
    }
});

// ─── getHiddenGems — drive signal with stubbed vector helpers ──────────────

test('getHiddenGems: items carry a "Similar to <seed>" reason (the section type alone does not say which seed)', async () => {
    await seedCafe();
    await seedStation(TEST_CAFE_ID);
    // Seed: a highly-rated seed item (above POSITIVE_REVIEW_THRESHOLD=7) +
    // an under-reviewed gem candidate (no reviews).
    const seedItem = await seedMenuItem({ id: 'mi-hg-seed', name: 'Award-Winning Burger' });
    const gemItem = await seedMenuItem({ id: 'mi-hg-gem', name: 'Hidden Veggie Bowl' });

    // Seed must clear POSITIVE_REVIEW_THRESHOLD (=7).
    await seedReview(await seedUser('u-hg-1'), seedItem, 10);
    await seedReview(await seedUser('u-hg-2'), seedItem, 9);

    const restore = stubSearchThreadHandler({
        diverseWeightedSample:   (data) => {
            // Return all candidate seed IDs unchanged (selects them all).
            if (data == null || typeof data !== 'object' || !('entityIds' in data)
                || !Array.isArray(data.entityIds)) {
                throw new Error('unexpected diverseWeightedSample call shape');
            }
            return data.entityIds;
        },
        searchSimilarByEntityId: () => [
            { id: 'mi-hg-gem', distance: 0.15 },
        ],
    });

    try {
        const items = [seedItem, gemItem].map(i => toCandidate(i));
        const section = await getHiddenGems(buildCafeContext(items));

        assert.ok(section, 'hidden-gems section must be produced');
        assert.equal(section.type, RecommendationSectionType.hiddenGems);
        assert.equal(section.items.length, 1, 'expected one gem candidate');
        const [gem] = section.items;
        assert.ok(gem);
        assert.equal(gem.menuItemId, 'mi-hg-gem');
        // Hidden gems is the *contrasting* case: it keeps a per-item reason
        // because the section type alone doesn't tell the user which seed
        // produced the gem. (The fix in 10fe96b deliberately left this signal
        // alone.)
        assert.equal(
            gem.reason,
            'Similar to Award-Winning Burger',
            'hidden-gems items must keep their contextual "Similar to <seed>" reason',
        );
    } finally {
        restore();
    }
});

// ─── Overview fallback contract: signal + getDefaultReasonForSectionType ───

test('overview fallback: a popular signal item displays "Highly rated" via the section default', async () => {
    await seedCafe();
    await seedStation(TEST_CAFE_ID);
    const item = await seedMenuItem({ id: 'mi-ov-1', name: 'Daily Burger' });
    await seedReview(await seedUser('u-ov-1'), item, 8);

    const section = await getPopularItems(buildCafeContext([toCandidate(item)]));
    assert.ok(section);
    const [popular] = section.items;
    assert.ok(popular);

    // Simulate routes/api/cafe/menu/overview.ts: the per-item reason is
    // undefined (the fix), so the section default fills in.
    const displayedReason = popular.reason || getDefaultReasonForSectionType(section.type);

    assert.equal(popular.reason, undefined,
        'popular signal must produce no per-item reason post-fix (10fe96b)');
    assert.equal(displayedReason, 'Highly rated',
        'overview route must fall back to "Highly rated" for popular items');
});
