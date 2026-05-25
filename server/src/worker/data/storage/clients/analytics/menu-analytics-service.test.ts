/**
 * End-to-end test for the Menu Analytics data service.
 *
 * Drives `services.data.menuAnalytics.*` through the InProcessHandler to
 * `menuAnalyticsServiceCommands` and the backing cache/storage orchestration.
 */

import { after, before, test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { SearchEntityType } from '@msdining/common/models/search';
import { getMondayForWeek, toDateString } from '@msdining/common/util/date-util';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../../../../../tests/test-server/integration-test-context.js';
import { getServices } from '../../../../../shared/services/registry.js';
import { menuAnalyticsService } from '../../../../../main/services/data/menu-analytics.js';
import { CAFES_BY_ID } from '../../../../../shared/constants/cafes.js';
import type { ICafe, ICafeConfig, ICafeStation, IMenuItemBase } from '../../../../../shared/models/cafe.js';

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
    tenantId:         'tenant-menu-analytics-service',
    contextId:        'ctx-menu-analytics-service',
    displayProfileId: 'dp-menu-analytics-service',
    storeId:          'store-menu-analytics-service',
    externalName:     CAFE.name,
    logoName:         'menu-analytics-service-logo.png',
    isShutDown:       false,
};

const STATION: ICafeStation = {
    id:                        'menu-analytics-service-station',
    menuId:                    'menu-analytics-service-menu',
    cafeId:                    CAFE.id,
    groupId:                   null,
    name:                      'Analytics Station',
    logoUrl:                   'https://example.com/analytics-station.png',
    menuItemIdsByCategoryName: new Map(),
    menuItemsById:             new Map(),
    opensAt:                   660,
    closesAt:                  840,
};

const MENU_ITEM: IMenuItemBase = {
    id:             'menu-analytics-service-menu-item',
    groupId:        null,
    cafeId:         CAFE.id,
    stationId:      STATION.id,
    price:          13.5,
    name:           'Analytics Service Pasta',
    receiptText:    'ANALYTICS SERVICE PASTA',
    calories:       610,
    maxCalories:    690,
    hasThumbnail:   false,
    modifiers:      [],
    imageUrl:       'https://example.com/menu-analytics-service-menu-item.png',
    description:    'Menu item used by menu analytics integration tests',
    lastUpdateTime: new Date('2026-01-15T12:00:00Z'),
    tags:           new Set(['featured']),
    searchTags:     new Set(['pasta']),
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

test('services.data.menuAnalytics is the typed client', () => {
    assert.equal(getServices().data.menuAnalytics, menuAnalyticsService);
});

test('getShutdownCafeState returns a record', async () => {

    const state = await getServices().data.menuAnalytics.getShutdownCafeState({
        dateString: DATE_STRING,
    });

    assert.equal(typeof state, 'object');
    assert.equal(Array.isArray(state), false);
});

test('retrieveVisitData returns an array', async () => {

    const visits = await getServices().data.menuAnalytics.retrieveVisitData({
        entityType: SearchEntityType.menuItem,
        name: MENU_ITEM.name,
    });

    assert.ok(Array.isArray(visits));
});

test('retrieveUniquenessDataForCafe returns a record', async () => {

    const data = await getServices().data.menuAnalytics.retrieveUniquenessDataForCafe({
        cafeId: CAFE.id,
        targetDateString: DATE_STRING,
    });

    assert.equal(typeof data, 'object');
    assert.equal(Array.isArray(data), false);
});
