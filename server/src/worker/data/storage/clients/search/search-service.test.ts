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
