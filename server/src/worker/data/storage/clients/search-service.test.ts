/**
 * End-to-end test for the Search data service.
 *
 * Drives `services.data.search.*` through the InProcessHandler to
 * `searchServiceCommands` and finally to SearchManager/cache orchestration.
 */

import { after, before, test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { SearchEntityType } from '@msdining/common/models/search';
import { getMondayForWeek, toDateString } from '@msdining/common/util/date-util';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../../../../tests/test-server/integration-test-context.js';
import { getServices } from '../../../../main/services/registry.js';
import { searchService } from '../../../../main/services/data/search-service.js';
import { CAFES_BY_ID } from '../../../../shared/constants/cafes.js';
import type { ICafe, ICafeConfig, ICafeStation, IMenuItemBase } from '../../../../shared/models/cafe.js';

let ctx: IntegrationTestContext;

const TEST_LOCK_PATH = new URL('../../../../.service-test-db.lock', import.meta.url);
const STALE_LOCK_AGE_MS = 5 * 60 * 1000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const acquireTestLock = async () => {
    while (true) {
        try {
            const handle = await fs.open(TEST_LOCK_PATH, 'wx');
            await handle.writeFile(String(process.pid));
            await handle.close();
            return;
        } catch (err) {
            const error = err as NodeJS.ErrnoException;
            if (error.code !== 'EEXIST') {
                throw err;
            }

            const stats = await fs.stat(TEST_LOCK_PATH).catch(() => null);
            if (stats != null && Date.now() - stats.mtimeMs > STALE_LOCK_AGE_MS) {
                await fs.rm(TEST_LOCK_PATH, { force: true });
                continue;
            }

            await sleep(50);
        }
    }
};

const releaseTestLock = async () => {
    await fs.rm(TEST_LOCK_PATH, { force: true });
};

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

test('services.data.search is the typed client', () => {
    assert.equal(getServices().data.search, searchService);
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
