import { after, before, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import { getEntityKey } from '@msdining/common/util/entity-key';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../../../../../tests/test-server/integration-test-context.js';
import { getServices } from '../../../../../shared/services/registry.js';
import type { ICafe, ICafeConfig, ICafeStation } from '../../../../../shared/models/cafe.js';
import type { IMenuItemBase } from '@msdining/common/models/cafe';

let ctx: IntegrationTestContext;
let uniqueId = 0;

const nextId = (prefix: string) => `${prefix}-${++uniqueId}`;

const CAFE: ICafe = {
    id: 'review-test-cafe',
    name: 'Review Test Café',
};

const CONFIG: ICafeConfig = {
    tenantId: 'tenant-review',
    contextId: 'context-review',
    displayProfileId: 'display-review',
    storeId: 'store-review',
    externalName: 'Review Test Cafe',
    isShutDown: false,
};

const STATION: ICafeStation = {
    id: 'review-test-station',
    name: 'Review Test Station',
    menuId: 'review-test-menu',
    cafeId: CAFE.id,
    groupId: null,
    logoUrl: 'https://example.com/review-station.png',
    menuItemsById: new Map(),
    menuItemIdsByCategoryName: new Map(),
    opensAt: 0,
    closesAt: 0,
};

const MENU_ITEM: IMenuItemBase = {
    id: 'review-test-menu-item',
    name: 'Review Test Burger',
    description: 'Menu item used by review service integration tests',
    cafeId: CAFE.id,
    stationId: STATION.id,
    groupId: null,
    price: 12.5,
    receiptText: 'REVIEW TEST BURGER',
    calories: 650,
    maxCalories: 650,
    hasThumbnail: false,
    modifiers: [],
    tags: new Set(['featured']),
    searchTags: new Set(['burger']),
};

const MENU_ITEM_NORMALIZED_NAME = normalizeNameForSearch(MENU_ITEM.name);
const STATION_NORMALIZED_NAME = normalizeNameForSearch(STATION.name);

before(async () => {
    ctx = await createIntegrationTestContext();

    await getServices().data.cafe.resetCache({});
    await getServices().data.cafe.createCafe({
        cafe: CAFE,
        config: CONFIG,
    });
    await getServices().data.station.createStation({ station: STATION });
    await getServices().data.menuItem.saveMenuItem({ menuItem: MENU_ITEM });
});

after(async () => {
    await ctx.cleanup();
});

test('createMenuItemReview + getReviewsForMenuItem round-trip', async () => {

    const review = await getServices().data.review.createMenuItemReview({
        review: {
            menuItemId: MENU_ITEM.id,
            normalizedName: MENU_ITEM_NORMALIZED_NAME,
            rating: 5,
            comment: nextId('menu-item-comment'),
            displayName: 'Anonymous Menu Reviewer',
            groupId: null,
        },
    });

    const result = await getServices().data.review.getReviewsForMenuItem({ menuItem: MENU_ITEM });
    const savedReview = result.menuItemReviews.find(candidate => candidate.id === review.id);

    assert.ok(savedReview);
    assert.equal(savedReview.rating, 5);
    assert.equal(savedReview.menuItemId, MENU_ITEM.id);
    assert.equal(savedReview.comment, 'menu-item-comment-1');
});

test('createStationReview + getReviewsForStation round-trip', async () => {

    const comment = nextId('station-comment');
    const review = await getServices().data.review.createStationReview({
        review: {
            stationId: STATION.id,
            normalizedName: STATION_NORMALIZED_NAME,
            rating: 4,
            comment,
            displayName: 'Anonymous Station Reviewer',
            groupId: null,
        },
    });

    const reviews = await getServices().data.review.getReviewsForStation({
        station: { name: STATION.name, groupId: STATION.groupId },
    });
    const savedReview = reviews.find(candidate => candidate.id === review.id);

    assert.ok(savedReview);
    assert.equal(savedReview.stationId, STATION.id);
    assert.equal(savedReview.comment, comment);
    assert.equal(savedReview.rating, 4);
});

test('isOwnedByUser returns false for nonexistent review', async () => {

    const isOwned = await getServices().data.review.isOwnedByUser({
        reviewId: 'missing-review-id',
        userId: 'missing-user-id',
    });

    assert.equal(isOwned, false);
});

test('getRecentReviews returns reviews ordered by recency', async () => {

    const older = await getServices().data.review.createMenuItemReview({
        review: {
            menuItemId: MENU_ITEM.id,
            normalizedName: MENU_ITEM_NORMALIZED_NAME,
            rating: 2,
            comment: nextId('recent-older'),
            displayName: 'Older Reviewer',
            groupId: null,
        },
    });

    // SQLite CURRENT_TIMESTAMP has second-level precision, so we must
    // cross a second boundary to get a deterministic ordering.
    await new Promise(resolve => setTimeout(resolve, 1100));

    const newer = await getServices().data.review.createStationReview({
        review: {
            stationId: STATION.id,
            normalizedName: STATION_NORMALIZED_NAME,
            rating: 3,
            comment: nextId('recent-newer'),
            displayName: 'Newer Reviewer',
            groupId: null,
        },
    });

    const recent = await getServices().data.review.getRecentReviews({ count: 2 });

    assert.equal(recent[0]?.id, newer.id);
    assert.equal(recent[1]?.id, older.id);
});

test('getAllMenuItemReviewHeaders returns aggregate data after creating reviews', async () => {

    const entityKey = getEntityKey(MENU_ITEM);
    const headersBefore = await getServices().data.review.getAllMenuItemReviewHeaders({});
    const before = headersBefore.find(header => header.entityKey === entityKey);
    const beforeCount = before?.totalReviewCount ?? 0;
    const beforeOverall = before?.overallRating ?? 0;

    await getServices().data.review.createMenuItemReview({
        review: {
            menuItemId: MENU_ITEM.id,
            normalizedName: MENU_ITEM_NORMALIZED_NAME,
            rating: 4,
            comment: nextId('header-comment'),
            displayName: 'Header Reviewer A',
            groupId: null,
        },
    });
    await getServices().data.review.createMenuItemReview({
        review: {
            menuItemId: MENU_ITEM.id,
            normalizedName: MENU_ITEM_NORMALIZED_NAME,
            rating: 2,
            comment: nextId('header-comment'),
            displayName: 'Header Reviewer B',
            groupId: null,
        },
    });

    const headersAfter = await getServices().data.review.getAllMenuItemReviewHeaders({});
    const afterHeader = headersAfter.find(header => header.entityKey === entityKey);

    assert.ok(afterHeader);
    assert.equal(afterHeader.totalReviewCount, beforeCount + 2);

    const expectedOverall = ((beforeOverall * beforeCount) + 4 + 2) / (beforeCount + 2);
    assert.ok(Math.abs(afterHeader.overallRating - expectedOverall) < 1e-9);
});

test('deleteReview removes a review', async () => {

    const review = await getServices().data.review.createMenuItemReview({
        review: {
            menuItemId: MENU_ITEM.id,
            normalizedName: MENU_ITEM_NORMALIZED_NAME,
            rating: 1,
            comment: nextId('delete-review'),
            displayName: 'Delete Reviewer',
            groupId: null,
        },
    });

    await getServices().data.review.deleteReview({ reviewId: review.id });

    const deleted = await getServices().data.review.getReviewById({ reviewId: review.id });
    const result = await getServices().data.review.getReviewsForMenuItem({ menuItem: MENU_ITEM });

    assert.equal(deleted, null);
    assert.equal(result.menuItemReviews.some(candidate => candidate.id === review.id), false);
});

test('retrieveReviewHeader returns aggregate data for a menu item', async () => {

    const header = await getServices().data.review.retrieveReviewHeader({ menuItem: MENU_ITEM });
    assert.ok(header);
    assert.equal(typeof header.totalReviewCount, 'number');
    assert.equal(typeof header.overallRating, 'number');
});

test('retrieveReviewHeaderByParts returns data for a name', async () => {

    const header = await getServices().data.review.retrieveReviewHeaderByParts({
        groupId: null,
        name: MENU_ITEM_NORMALIZED_NAME,
    });
    assert.ok(header);
    assert.equal(typeof header.totalReviewCount, 'number');
});

test('retrieveStationReviewHeader returns aggregate data', async () => {

    const header = await getServices().data.review.retrieveStationReviewHeader({
        station: { name: STATION.name, groupId: null },
    });
    assert.ok(header);
    assert.equal(typeof header.totalReviewCount, 'number');
});

test('retrieveStationReviewHeaderByParts returns data', async () => {

    const header = await getServices().data.review.retrieveStationReviewHeaderByParts({
        groupId: null,
        name: STATION_NORMALIZED_NAME,
    });
    assert.ok(header);
    assert.equal(typeof header.totalReviewCount, 'number');
});
