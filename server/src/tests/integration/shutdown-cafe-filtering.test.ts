/**
 * Integration test for `90487f7` — shut-down cafes must not appear in
 * search results or recommendations.
 *
 * Regression: shut-down cafes still surfaced items via /search and the
 * recommendation pipeline. Fix added `getShutDownCafeIdsAsync()` filtering
 * in both spots (api/cache/daily-cafe-state.ts; api/cache/recommendations.ts;
 * api/recommendations/shared.ts; api/storage/clients/daily-menu.ts).
 *
 * Setup: pin clock to a weekday and sync only the cafes this test cares
 * about (two shutdown candidates plus a few non-shutdown controls). We
 * deliberately avoid `performMenuBootTasks()` here so we don't enqueue
 * 50+ menuPublished-triggered recommendation seeds — those run on a
 * concurrency-limited semaphore that can outlive the test, which on
 * Windows triggers a libuv panic at `--test-force-exit`.
 */

import { after, before, mock, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { DateUtil } from '@msdining/common';
import { CafeMenuSession } from '../../worker/data/cafe/session/menu.js';
import { saveDailyMenuAsync } from '../../worker/data/cafe/job/storage.js';
import { classifyShutdownMessageAsync } from '../../worker/data/cafe/shutdown-classifier.js';
import { DailyMenuStorageClient } from '../../worker/data/storage/clients/daily-menu.js';
import { ALL_CAFES } from '../../shared/constants/cafes.js';
import { ICafe } from '../../shared/models/cafe.js';
import {
    RecommendationsResponseSchema,
} from '@msdining/common/models/recommendation';
import { SearchResponseSchema } from '@msdining/common/models/http';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../test-server/integration-test-context.js';
import { fetchJson } from '../test-server/test-helpers.js';

const SHUTDOWN_CAFE_IDS = ['cafe83', 'cafe92'] as const;
const SHUTDOWN_MESSAGE = 'Closed for the integration test — back soon';

// Non-shutdown cafes that also serve cheeseburgers (verified via fixtures).
// Used both as recommendation homepageIds and as search-result controls.
const CONTROL_CAFE_IDS = ['cafe25', 'b3espresso', 'b7espresso'] as const;

const ALL_TEST_CAFE_IDS: ReadonlyArray<string> = [...CONTROL_CAFE_IDS, ...SHUTDOWN_CAFE_IDS];

const FAKE_NOW = new Date('2026-05-13T12:00:00Z'); // Wednesday

let ctx: IntegrationTestContext;
let baseUrl: string;
let todayString: string;

const syncOneCafe = async (cafe: ICafe, isShutdown: boolean): Promise<void> => {
    const result = await CafeMenuSession.retrieveMenuAsync(cafe, 0);

    let shutdownMessageHash: string | null = null;
    if (isShutdown && result.isShutDown && result.shutDownMessage) {
        const classification = await classifyShutdownMessageAsync(result.shutDownMessage);
        shutdownMessageHash = classification.messageHash;
    }

    await DailyMenuStorageClient.upsertDailyCafeAsync(cafe.id, todayString, {
        isAvailable: result.isAvailable,
        shutdownMessageHash,
    });
    await saveDailyMenuAsync({
        cafe,
        dateString: todayString,
        isAvailable: result.isAvailable,
        stations: result.stations,
        shouldUpdateExistingItems: true,
    });
};

before(async () => {
    mock.timers.enable({ apis: ['Date'], now: FAKE_NOW });
    todayString = DateUtil.toDateString(new Date());

    ctx = await createIntegrationTestContext();
    ctx.installServices();

    for (const cafeId of SHUTDOWN_CAFE_IDS) {
        ctx.server.markCafeShutdown(cafeId, SHUTDOWN_MESSAGE);
    }

    // Sync only the cafes we exercise. Keeps the menuPublished fan-out
    // small enough that any seeded recommendation work finishes before
    // the file's after() hook (or at least doesn't hold open enough
    // handles to trip --test-force-exit on Windows).
    for (const cafeId of ALL_TEST_CAFE_IDS) {
        const cafe = ALL_CAFES.find((c) => c.id === cafeId);
        assert.ok(cafe, `${cafeId} should exist in ALL_CAFES`);
        await syncOneCafe(cafe, SHUTDOWN_CAFE_IDS.includes(cafeId as typeof SHUTDOWN_CAFE_IDS[number]));
    }

    baseUrl = await ctx.startWebserver();
}, { timeout: 120_000 });

after(async () => {
    // Give in-flight async work (recommendation seeding, embeddings queue,
    // worker-thread RPC roundtrips) a chance to settle before tearing the
    // context down. Without this, --test-force-exit on Windows can hit a
    // libuv `UV_HANDLE_CLOSING` assertion when search + recommendations
    // both have queued background tasks.
    await new Promise((resolve) => setTimeout(resolve, 500));
    await ctx.cleanup();
    mock.timers.reset();
});

test('search results exclude items from shut-down cafes (non-vector path)', async () => {
    ctx.installServices();
    // Force the non-vector path with `nv=true` so we don't depend on the
    // embeddings worker draining before the request — the bug fix is at
    // the DB-query layer (getMenusForSearch filters shutdownMessageHash),
    // which both paths consume.
    const results = await fetchJson(
        `${baseUrl}/api/dining/search?q=cheeseburger&nv=true&date=${todayString}`,
        SearchResponseSchema,
    );

    assert.ok(results.length > 0, 'expected at least one search hit for "cheeseburger"');

    for (const result of results) {
        for (const shutdownId of SHUTDOWN_CAFE_IDS) {
            assert.ok(
                !(shutdownId in result.locations),
                `result "${result.name}" still references shut-down cafe ${shutdownId} in locations: ${JSON.stringify(result.locations)}`,
            );
        }
    }
});

test('search results still include items from non-shut-down cafes (control)', async () => {
    ctx.installServices();
    const results = await fetchJson(
        `${baseUrl}/api/dining/search?q=cheeseburger&nv=true&date=${todayString}`,
        SearchResponseSchema,
    );

    const controlAppears = results.some((result) =>
        CONTROL_CAFE_IDS.some((id) => id in result.locations),
    );
    assert.ok(
        controlAppears,
        `expected at least one search result located at a control cafe (${CONTROL_CAFE_IDS.join(', ')}); got ${results.length} result(s)`,
    );
});

// homepageIds keep the per-cafe "newAtFavorites" section alive (it's
// deleted for non-homepage cafes; see recommendations.ts:185). Without
// review data seeded, popular/hidden-gems would return null, so this
// section is the simplest way to get non-empty output from the test fixture.
const recommendationsUrl = () =>
    `${baseUrl}/api/dining/recommendations/for-you?date=${todayString}&homepageIds=${CONTROL_CAFE_IDS.join(',')}`;

test('recommendations exclude items from shut-down cafes', async () => {
    ctx.installServices();
    const response = await fetchJson(recommendationsUrl(), RecommendationsResponseSchema);

    const allItems = response.sections.flatMap((section) => section.items);
    assert.ok(allItems.length > 0, 'expected the recommender to produce at least one item');

    for (const item of allItems) {
        for (const shutdownId of SHUTDOWN_CAFE_IDS) {
            assert.notEqual(
                item.cafeId,
                shutdownId,
                `recommendation "${item.name}" was sourced from shut-down cafe ${shutdownId}`,
            );
        }
    }
});

test('recommendations still include items from non-shut-down cafes (control)', async () => {
    ctx.installServices();
    const response = await fetchJson(recommendationsUrl(), RecommendationsResponseSchema);

    const allItems = response.sections.flatMap((section) => section.items);
    const sourceCafeIds = new Set(allItems.map((item) => item.cafeId));

    for (const shutdownId of SHUTDOWN_CAFE_IDS) {
        assert.ok(
            !sourceCafeIds.has(shutdownId),
            `recommendations should not include shut-down cafe ${shutdownId}`,
        );
    }

    // Control: assert at least one control cafe IS present. Without this the
    // shutdown-exclusion assertion above would pass vacuously if the response
    // happened to be empty.
    const controlHit = [...sourceCafeIds].some((id) => CONTROL_CAFE_IDS.includes(id as typeof CONTROL_CAFE_IDS[number]));
    assert.ok(
        controlHit,
        `expected at least one recommendation from a control cafe (${CONTROL_CAFE_IDS.join(', ')}); got: ${[...sourceCafeIds].join(', ')}`,
    );
});
