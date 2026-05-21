/**
 * End-to-end test for the MenuItem data service.
 *
 * Drives `services.data.menuItem.*` through the InProcessHandler to
 * `menuItemServiceCommands` and finally to `MenuItemStorageClient`.
 */

import { after, before, test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../../../../tests/test-server/integration-test-context.js';
import { getServices } from '../../../../main/services/registry.js';
import { menuItemService } from '../../../../main/services/data/menu-item.js';
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
    id:   'menu-item-service-cafe',
    name: 'Menu Item Service Cafe',
};

const CONFIG: ICafeConfig = {
    tenantId:         'tenant-menu-item',
    contextId:        'ctx-menu-item',
    displayProfileId: 'dp-menu-item',
    storeId:          'store-menu-item',
    externalName:     'Menu Item Service Cafe',
    logoName:         'menu-item-logo.png',
    isShutDown:       false,
};

const STATION: ICafeStation = {
    id:                        'menu-item-service-station',
    menuId:                    'menu-item-service-menu',
    cafeId:                    CAFE.id,
    groupId:                   null,
    name:                      'Grill Station',
    logoUrl:                   'https://example.com/grill.png',
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

const createMenuItem = ({
    id,
    name,
    tags = [],
    searchTags = [],
}: {
    id: string;
    name: string;
    tags?: string[];
    searchTags?: string[];
}): IMenuItemBase => ({
    id,
    groupId:        null,
    cafeId:         CAFE.id,
    stationId:      STATION.id,
    price:          10.5,
    name,
    receiptText:    `${name} receipt`,
    calories:       540,
    maxCalories:    620,
    hasThumbnail:   false,
    modifiers:      [],
    imageUrl:       'https://example.com/menu-item.png',
    description:    `${name} description`,
    lastUpdateTime: new Date('2026-01-15T12:00:00Z'),
    tags:           new Set(tags),
    searchTags:     new Set(searchTags),
});

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
});

after(async () => {
    resetMenuItemCache();
    await ctx.cleanup();
    await releaseTestLock();
});

test('services.data.menuItem is the typed client', () => {
    ctx.installServices();
    assert.equal(getServices().data.menuItem, menuItemService);
});

test('retrieveMenuItem returns null for nonexistent id', async () => {
    ctx.installServices();
    resetMenuItemCache();

    const result = await getServices().data.menuItem.retrieveMenuItem({ id: 'no-such-menu-item' });
    assert.equal(result, null);
});

test('saveMenuItem + retrieveMenuItem round-trip', async () => {
    ctx.installServices();

    const menuItem = createMenuItem({
        id:   'menu-item-round-trip',
        name: 'Crispy Tofu Bowl',
        tags: ['vegan', 'spicy'],
    });

    await getServices().data.menuItem.saveMenuItem({ menuItem });
    resetMenuItemCache();

    const record = await getServices().data.menuItem.retrieveMenuItem({ id: menuItem.id });
    assert.ok(record);
    assert.equal(record.id, menuItem.id);
    assert.equal(record.name, menuItem.name);
    assert.equal(record.description, menuItem.description);
    assert.equal(record.imageUrl, menuItem.imageUrl);
    assert.equal(record.price, menuItem.price);
    assert.equal(record.calories, menuItem.calories);
    assert.equal(record.maxCalories, menuItem.maxCalories);
    assert.equal(record.cafeId, menuItem.cafeId);
    assert.equal(record.stationId, menuItem.stationId);
    assert.equal(record.receiptText, menuItem.receiptText);
    assert.equal(record.lastUpdateTime?.toISOString(), menuItem.lastUpdateTime?.toISOString());
    assert.deepEqual(Array.from(record.tags).sort(), Array.from(menuItem.tags).sort());
    assert.deepEqual(record.modifiers, []);
});

test('retrieveAllMenuItemsWithoutGroup includes saved items without a groupId', async () => {
    ctx.installServices();

    const menuItem = createMenuItem({
        id:   'menu-item-without-group',
        name: 'Tomato Soup',
    });

    await getServices().data.menuItem.saveMenuItem({ menuItem });

    const menuItems = await getServices().data.menuItem.retrieveAllMenuItemsWithoutGroup({});
    assert.ok(menuItems.some(item => item.id === menuItem.id));
});

test('getCachedMenuItemNames returns names of saved items', async () => {
    ctx.installServices();

    const menuItem = createMenuItem({
        id:   'menu-item-cached-name',
        name: 'Herb Roasted Potatoes',
    });

    await getServices().data.menuItem.saveMenuItem({ menuItem });

    const names = await getServices().data.menuItem.getCachedMenuItemNames({});
    assert.ok(names.includes(menuItem.name));
});

test('getTopSearchTags returns an array', async () => {
    ctx.installServices();

    const menuItem = createMenuItem({
        id:         'menu-item-top-tags',
        name:       'Chili Lime Tacos',
        searchTags: ['chili', 'lime'],
    });

    await getServices().data.menuItem.saveMenuItem({ menuItem });

    const topSearchTags = await getServices().data.menuItem.getTopSearchTags({});
    assert.ok(Array.isArray(topSearchTags));
    assert.ok(topSearchTags.includes('chili'));
});

test('updateThumbnailHash does not throw and the item remains retrievable', async () => {
    ctx.installServices();

    const menuItem = createMenuItem({
        id:   'menu-item-thumbnail',
        name: 'Blueberry Muffin',
    });

    await getServices().data.menuItem.saveMenuItem({ menuItem });
    await assert.doesNotReject(
        getServices().data.menuItem.updateThumbnailHash({
            menuItemId: menuItem.id,
            hash:       'thumb-hash-1',
        }),
    );

    resetMenuItemCache();
    const record = await getServices().data.menuItem.retrieveMenuItem({ id: menuItem.id });
    assert.ok(record);
    assert.equal(record.id, menuItem.id);
    assert.equal(record.thumbnailId, 'thumb-hash-1');
});
