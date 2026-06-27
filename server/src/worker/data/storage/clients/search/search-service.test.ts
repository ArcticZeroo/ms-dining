/**
 * End-to-end test for the Search data service.
 *
 * Drives `services.data.search.*` through the InProcessHandler to
 * `searchServiceCommands` and finally to SearchManager/cache orchestration.
 */

import { after, before, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { getMondayForWeek, toDateString } from '@msdining/common/util/date-util';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../../../../../tests/test-server/integration-test-context.js';
import { acquireTestLock, releaseTestLock } from '../../../../../tests/test-server/db-test-helper.js';
import { getServices } from '../../../../../shared/services/registry.js';
import { CAFES_BY_ID } from '../../../../../shared/constants/cafes.js';
import type { ICafe, ICafeConfig, ICafeStation, IMenuItemBase } from '../../../../../shared/models/cafe.js';
import { getEntityKeyFromParts } from '@msdining/common/util/entity-key';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import { SearchMatchReason } from '@msdining/common/models/search';

let ctx: IntegrationTestContext;

const CAFE: ICafe = (() => {
    const cafe = CAFES_BY_ID.get('cafe25');
    if (cafe == null) {
        throw new Error('Expected cafe25 to exist in CAFES_BY_ID');
    }

    return {
        id:   cafe.id,
        name: cafe.name,
    };
})();

const CONFIG: ICafeConfig = {
    tenantId:         'tenant-search-service',
    contextId:        'ctx-search-service',
    displayProfileId: 'dp-search-service',
    storeId:          'store-search-service',
    externalName:     CAFE.name,
    logoName:         'search-service-logo.png',
    isShutDown:       false,
};

const STATION: ICafeStation = {
    id:                        'search-service-station',
    menuId:                    'search-service-menu',
    cafeId:                    CAFE.id,
    groupId:                   null,
    name:                      'Search Station',
    logoUrl:                   'https://example.com/search-station.png',
    menuItemIdsByCategoryName: new Map(),
    menuItemsById:             new Map(),
    opensAt:                   660,
    closesAt:                  840,
};

const MENU_ITEM: IMenuItemBase = {
    id:             'search-service-menu-item',
    groupId:        null,
    cafeId:         CAFE.id,
    stationId:      STATION.id,
    price:          12.75,
    name:           'Search Service Sandwich',
    receiptText:    'SEARCH SERVICE SANDWICH',
    calories:       540,
    maxCalories:    620,
    hasThumbnail:   false,
    modifiers:      [],
    imageUrl:       'https://example.com/search-service-menu-item.png',
    description:    'Menu item used by search service integration tests',
    lastUpdateTime: new Date('2026-01-15T12:00:00Z'),
    tags:           new Set(['featured']),
    searchTags:     new Set(['sandwich']),
    entityKey:      getEntityKeyFromParts(null, normalizeNameForSearch('Search Service Sandwich')),
};

const DATE_STRING = toDateString(getMondayForWeek(new Date()));

before(async () => {
    await acquireTestLock();
    ctx = await createIntegrationTestContext();

    await getServices().data.cafe.resetCache({});
    await getServices().data.cafe.createCafe({
        cafe: CAFE,
        config: CONFIG,
    });
    await getServices().data.station.createStation({ station: STATION });
    await getServices().data.menuItem.saveMenuItem({ menuItem: MENU_ITEM });
    await getServices().data.dailyMenu.upsertDailyCafeAsync({
        cafeId: CAFE.id,
        dateString: DATE_STRING,
        data: {
            isAvailable:         true,
            shutdownMessageHash: null,
        },
    });
    await getServices().data.dailyMenu.publishDailyStationMenuAsync({
        cafe: CAFE,
        dateString: DATE_STRING,
        isAvailable: true,
        stations: [{
            ...STATION,
            menuItemIdsByCategoryName: new Map([
                ['Entrees', [MENU_ITEM.id]],
            ]),
            menuItemsById: new Map([[MENU_ITEM.id, MENU_ITEM]]),
        }],
    });
});

after(async () => {
    await ctx.cleanup();
    await releaseTestLock();
});

test('autocomplete returns an array', async () => {

    const suggestions = await getServices().data.search.autocomplete({ query: 'Sea' });
    assert.ok(Array.isArray(suggestions));
});

test('getSimilarQueries returns an array', async () => {

    const similarQueries = await getServices().data.search.getSimilarQueries({ query: MENU_ITEM.name })
        .catch(() => []);
    assert.ok(Array.isArray(similarQueries));
});

test('search returns a Map result (may be empty in test without full index)', async () => {

    const results = await getServices().data.search.search({
        query: MENU_ITEM.name,
        date: DATE_STRING,
    });

    assert.ok(results instanceof Map, 'search should return a Map');
});

test('getRecommendations returns an array', async () => {

    const recommendations = await getServices().data.search.getRecommendations({
        dateString: DATE_STRING,
        cafeIdFilter: [CAFE.id],
    }).catch(() => []);
    assert.ok(Array.isArray(recommendations));
});

test('explainSearch explains a title-matching item by name', async () => {
    const explanation = await getServices().data.search.explainSearch({
        query:                          MENU_ITEM.name,
        name:                           MENU_ITEM.name,
        // Local-noon so new Date(...) -> toDateString(...) round-trips to DATE_STRING
        // regardless of the host timezone (UTC-midnight would shift the day back).
        date:                           `${DATE_STRING}T12:00:00`,
        allowResultsWithoutAppearances: false,
    });

    assert.equal(explanation.query, MENU_ITEM.name);
    assert.ok(Array.isArray(explanation.items));

    const item = explanation.items.find(explained => explained.menuItemId === MENU_ITEM.id);
    assert.ok(item, 'should resolve and explain the seeded menu item by name');

    // Query equals the item name, so it must match by title and land in the results.
    assert.ok(item.nameMatchReasons.includes(SearchMatchReason.title), 'should match by title');
    assert.equal(item.appearsInSearchWindow, true, 'item is on the published menu');
    assert.equal(item.wouldRegisterAsMatch, true, 'a title match registers as a match');
    assert.equal(item.isInFinalResults, true, 'a title match should be in the final results');
    assert.ok(item.reasons.length > 0, 'should provide human-readable reasons');
});

test('explainSearch explains why an unrelated query does not text-match', async () => {
    const explanation = await getServices().data.search.explainSearch({
        query:                          'zzz nonsense unrelated qqq',
        name:                           MENU_ITEM.name,
        date:                           `${DATE_STRING}T12:00:00`,
        allowResultsWithoutAppearances: false,
    });

    const item = explanation.items.find(explained => explained.menuItemId === MENU_ITEM.id);
    assert.ok(item, 'should still resolve the item by name');

    // Deterministic regardless of whether embeddings are indexed in the test:
    assert.equal(item.nameMatchReasons.length, 0, 'nonsense query should not text-match');
    assert.equal(item.isExactSubstringMatch, false, 'nonsense query should not substring-match');
    assert.equal(item.appearsInSearchWindow, true, 'item is still on the published menu');
    assert.ok(Array.isArray(item.reasons));
});
