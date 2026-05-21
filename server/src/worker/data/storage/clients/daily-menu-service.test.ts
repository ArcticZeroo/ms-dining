/**
 * End-to-end test for the DailyMenu data service.
 *
 * Drives `services.data.dailyMenu.*` through the InProcessHandler to
 * `dailyMenuServiceCommands` and finally to `DailyMenuStorageClient`.
 */

import { after, before, test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { getMondayForWeek, toDateString } from '@msdining/common/util/date-util';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../../../../tests/test-server/integration-test-context.js';
import { getServices } from '../../../../main/services/registry.js';
import { dailyMenuService } from '../../../../main/services/data/daily-menu.js';
import { CAFES_BY_ID } from '../../../../shared/constants/cafes.js';
import { MenuItemStorageClient } from './menu-item.js';
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

const CAFE: ICafe = {
    id:   'daily-menu-service-cafe',
    name: 'Daily Menu Service Cafe',
};

const CONFIG: ICafeConfig = {
    tenantId:         'tenant-daily-menu',
    contextId:        'ctx-daily-menu',
    displayProfileId: 'dp-daily-menu',
    storeId:          'store-daily-menu',
    externalName:     'Daily Menu Service Cafe',
    logoName:         'daily-menu-logo.png',
    isShutDown:       false,
};

const STATION: ICafeStation = {
    id:                        'daily-menu-service-station',
    menuId:                    'daily-menu-service-menu',
    cafeId:                    CAFE.id,
    groupId:                   null,
    name:                      'Main Line',
    logoUrl:                   'https://example.com/main-line.png',
    menuItemIdsByCategoryName: new Map(),
    menuItemsById:             new Map(),
    opensAt:                   660,
    closesAt:                  840,
};

const resetMenuItemCache = () => {
    const storage = MenuItemStorageClient as unknown as {
        _menuItemsById: Map<string, IMenuItemBase>;
        _menuIdsBySearchTag: Map<string, Set<string>>;
        _topSearchTags: string[] | undefined;
    };

    storage._menuItemsById.clear();
    storage._menuIdsBySearchTag.clear();
    storage._topSearchTags = undefined;
};

const createMenuItem = (id: string, name: string): IMenuItemBase => ({
    id,
    groupId:        null,
    cafeId:         CAFE.id,
    stationId:      STATION.id,
    price:          11.25,
    name,
    receiptText:    `${name} receipt`,
    calories:       480,
    maxCalories:    560,
    hasThumbnail:   false,
    modifiers:      [],
    imageUrl:       'https://example.com/daily-menu-item.png',
    description:    `${name} description`,
    lastUpdateTime: new Date('2026-01-15T12:00:00Z'),
    tags:           new Set(['featured']),
    searchTags:     new Set(),
});

const BASE_MENU_ITEM = createMenuItem('daily-menu-service-item', 'Roasted Vegetable Pasta');

const createPublishedStation = (menuItems: IMenuItemBase[]): ICafeStation => ({
    ...STATION,
    menuItemIdsByCategoryName: new Map([
        ['Entrees', menuItems.map(menuItem => menuItem.id)],
    ]),
    menuItemsById: new Map(menuItems.map(menuItem => [menuItem.id, menuItem])),
});

const publishMenuForDate = async (dateString: string, menuItems: IMenuItemBase[] = [BASE_MENU_ITEM]) => {
    await getServices().data.dailyMenu.upsertDailyCafeAsync({
        cafeId: CAFE.id,
        dateString,
        data: {
            isAvailable:         true,
            shutdownMessageHash: null,
        },
    });

    await getServices().data.dailyMenu.publishDailyStationMenuAsync({
        cafe: CAFE,
        dateString,
        isAvailable: true,
        stations: [createPublishedStation(menuItems)],
    });
};

before(async () => {
    await acquireTestLock();
    ctx = await createIntegrationTestContext();
    ctx.installServices();
    resetMenuItemCache();

    await getServices().data.cafe.resetCache({});
    await getServices().data.cafe.createCafe({
        cafe:   CAFE,
        config: CONFIG,
    });
    await getServices().data.station.createStation({ station: STATION });
    await getServices().data.menuItem.saveMenuItem({ menuItem: BASE_MENU_ITEM });
});

after(async () => {
    resetMenuItemCache();
    await ctx.cleanup();
    await releaseTestLock();
});

test('services.data.dailyMenu is the typed client', () => {
    ctx.installServices();
    assert.equal(getServices().data.dailyMenu, dailyMenuService);
});

test('isAnyMenuAvailableForDay returns false when no menus are published', async () => {
    ctx.installServices();

    const isAvailable = await getServices().data.dailyMenu.isAnyMenuAvailableForDayAsync({ dateString: '2026-01-15' });
    assert.equal(isAvailable, false);
});

test('publishDailyStationMenu + retrieveDailyMenu round-trip', async () => {
    ctx.installServices();

    const dateString = '2026-01-16';
    await publishMenuForDate(dateString);

    const stations = await getServices().data.dailyMenu.retrieveDailyMenuAsync({
        cafeId: CAFE.id,
        dateString,
    });

    assert.equal(stations.length, 1);
    const station = stations[0]!;
    assert.equal(station.id, STATION.id);
    assert.equal(station.name, STATION.name);
    assert.equal(station.cafeId, CAFE.id);
    assert.equal(station.menuId, STATION.menuId);
    assert.equal(station.logoUrl, STATION.logoUrl);
    assert.deepEqual(station.menuItemIdsByCategoryName.get('Entrees'), [BASE_MENU_ITEM.id]);
    assert.equal(station.menuItemsById.get(BASE_MENU_ITEM.id)?.name, BASE_MENU_ITEM.name);
});

test('getCafesAvailableForDay returns the cafe id after publishing', async () => {
    ctx.installServices();

    const dateString = '2026-01-17';
    await publishMenuForDate(dateString);

    const cafeIds = await getServices().data.dailyMenu.getCafesAvailableForDayAsync({ dateString });
    assert.ok(cafeIds.includes(CAFE.id));
});

test('isAnyMenuAvailableForDay returns true after publishing', async () => {
    ctx.installServices();

    const dateString = '2026-01-18';
    await publishMenuForDate(dateString);

    const isAvailable = await getServices().data.dailyMenu.isAnyMenuAvailableForDayAsync({ dateString });
    assert.equal(isAvailable, true);
});

test('retrieveFirstMenuItemVisitDate returns a date string after the item appears in a daily menu', async () => {
    ctx.installServices();

    const dateString = '2026-01-19';
    const menuItem = createMenuItem('daily-menu-service-visit-item', 'Garlic Herb Salmon');
    await getServices().data.menuItem.saveMenuItem({ menuItem });
    await publishMenuForDate(dateString, [menuItem]);

    const firstVisitDate = await getServices().data.dailyMenu.retrieveFirstMenuItemVisitDate({
        menuItemId: menuItem.id,
    });
    assert.equal(firstVisitDate, dateString);
});

test('upsertDailyCafe + retrieveDailyCafeState round-trip', async () => {
    ctx.installServices();

    const dateString = '2026-01-20';
    await getServices().data.dailyMenu.upsertDailyCafeAsync({
        cafeId: CAFE.id,
        dateString,
        data: {
            isAvailable:         true,
            shutdownMessageHash: null,
        },
    });

    const state = await getServices().data.dailyMenu.retrieveDailyCafeStateAsync({
        cafeId: CAFE.id,
        dateString,
    });
    assert.deepEqual(state, { isAvailable: true });
});

test('retrieveDailyCafeMenu returns stations after publishing a menu', async () => {
    ctx.installServices();

    const cacheCafe = CAFES_BY_ID.get('cafe25');
    assert.ok(cacheCafe, 'expected cafe25 to exist for cache-backed daily menu test');

    const cacheCafeConfig: ICafeConfig = {
        tenantId:         'tenant-daily-menu-cache',
        contextId:        'ctx-daily-menu-cache',
        displayProfileId: 'dp-daily-menu-cache',
        storeId:          'store-daily-menu-cache',
        externalName:     cacheCafe.name,
        logoName:         'daily-menu-cache-logo.png',
        isShutDown:       false,
    };
    const cacheStation: ICafeStation = {
        id:                        'daily-menu-service-cache-station',
        menuId:                    'daily-menu-service-cache-menu',
        cafeId:                    cacheCafe.id,
        groupId:                   null,
        name:                      'Cache Station',
        logoUrl:                   'https://example.com/cache-station.png',
        menuItemIdsByCategoryName: new Map(),
        menuItemsById:             new Map(),
        opensAt:                   660,
        closesAt:                  840,
    };
    const cacheMenuItem: IMenuItemBase = {
        ...createMenuItem('daily-menu-service-cache-item', 'Cache Test Bowl'),
        cafeId:    cacheCafe.id,
        stationId: cacheStation.id,
    };
    const dateString = toDateString(getMondayForWeek(new Date()));

    await getServices().data.cafe.createCafe({
        cafe: { id: cacheCafe.id, name: cacheCafe.name },
        config: cacheCafeConfig,
    });
    await getServices().data.station.createStation({ station: cacheStation });
    await getServices().data.menuItem.saveMenuItem({ menuItem: cacheMenuItem });
    await getServices().data.dailyMenu.upsertDailyCafeAsync({
        cafeId: cacheCafe.id,
        dateString,
        data: {
            isAvailable:         true,
            shutdownMessageHash: null,
        },
    });
    await getServices().data.dailyMenu.publishDailyStationMenuAsync({
        cafe: { id: cacheCafe.id, name: cacheCafe.name },
        dateString,
        isAvailable: true,
        stations: [{
            ...cacheStation,
            menuItemIdsByCategoryName: new Map([
                ['Entrees', [cacheMenuItem.id]],
            ]),
            menuItemsById: new Map([[cacheMenuItem.id, cacheMenuItem]]),
        }],
    });

    const stations = await getServices().data.dailyMenu.retrieveDailyCafeMenu({
        cafeId: cacheCafe.id,
        dateString,
    });

    assert.equal(stations.length, 1);
    assert.equal(stations[0]?.id, cacheStation.id);
    assert.equal(stations[0]?.menuItemsById.get(cacheMenuItem.id)?.name, cacheMenuItem.name);
});

test('getMenuWatermark returns a number', async () => {
    ctx.installServices();

    const dateString = '2026-01-22';
    await publishMenuForDate(dateString);

    const watermark = await getServices().data.dailyMenu.getMenuWatermark({
        cafeId: CAFE.id,
        dateString,
    });

    assert.equal(typeof watermark, 'number');
});
