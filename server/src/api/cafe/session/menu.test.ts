/**
 * Tests for CafeMenuSession's modifier/menu-item reconciliation logic.
 *
 * Each test installs custom station + menu-item fixtures via the test
 * server, then calls CafeMenuSession.retrieveMenuAsync to drive the real
 * production path. Item IDs are unique per test so the static
 * MenuItemStorageClient cache (process-scoped) can't leak state between
 * cases.
 *
 * Regression targets:
 *   2ca0ec9 — isItemCustomizationEnabled === false skips modifier fetch,
 *             but `undefined` is treated as "unknown" and still fetches.
 *   72f929e — menu items missing from menuItemsById are filtered out of
 *             the category lists before returning.
 *   127170b — modifier retrieval defaults to `[]` so downstream consumers
 *             never see undefined.
 */

import { after, before, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { CafeMenuSession } from './menu.js';
import { ICafe, ICafeStation } from '../../../models/cafe.js';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../../../test-server/integration-test-context.js';

let ctx: IntegrationTestContext;

before(async () => {
    ctx = await createIntegrationTestContext();
    ctx.installServices();
});

after(async () => {
    await ctx.cleanup();
});

const CAFE_ID = 'cafe25';
const CAFE: ICafe = { id: CAFE_ID, name: 'Test Cafe 25' };

interface FixtureItem {
    id: string;
    amount: string;
    displayText: string;
    properties: { calories: string; maxCalories: string };
    description?: string;
    lastUpdateTime: string;
    isItemCustomizationEnabled?: boolean;
    receiptText: string;
    tagIds?: string[];
    priceLevels: Record<string, unknown>;
    _modifiers?: {
        modifiers?: Array<{
            id: string;
            description: string;
            minimum: number;
            maximum: number;
            type: string;
            options: Array<{ id: string; description: string; amount: string }>;
        }>;
    };
}

interface FixtureStation {
    id: string;
    name: string;
    priceLevelConfig: { menuId: string };
    menus: Array<{
        id: string;
        name: string;
        categories: Array<{ categoryId: string; name: string; items: string[] }>;
        lastUpdateTime: string;
    }>;
    conceptOptions?: { onDemandDisplayText?: string; displayText?: string };
    availableAt?: { open: string; close: string };
    schedule?: unknown[];
    openScheduleExpression?: string;
    closeScheduleExpression?: string;
}

function defaultPriceLevels(amount: string): Record<string, unknown> {
    return {
        'pl-1': {
            priceLevelId: 'pl-1',
            name:         'Default',
            price:        { currencyUnit: 'USD', amount },
        },
    };
}

function defaultModifiers(itemId: string): FixtureItem['_modifiers'] {
    return {
        modifiers: [
            {
                id:          `${itemId}-mod-0`,
                description: 'Dressing',
                minimum:     0,
                maximum:     1,
                type:        'radio',
                options:     [
                    { id: `${itemId}-opt-0`, description: 'Ranch', amount: '0.00' },
                    { id: `${itemId}-opt-1`, description: 'Vinaigrette', amount: '0.00' },
                ],
            },
        ],
    };
}

function findStation(stations: ICafeStation[], stationId: string): ICafeStation {
    const station = stations.find(s => s.id === stationId);
    assert.ok(station, `expected station ${stationId} to be present (got ${stations.map(s => s.id).join(', ')})`);
    return station;
}

test('item with isItemCustomizationEnabled === false returns no modifiers (2ca0ec9)', async () => {
    ctx.installServices();
    const stationId = '2ca0ec9-a-station';
    const menuId = '2ca0ec9-a-menu';
    const itemId = '2ca0ec9-a-item-customization-off';

    const station: FixtureStation = {
        id:   stationId,
        name: 'Test Station',
        priceLevelConfig: { menuId },
        menus: [
            {
                id:             menuId,
                name:           'Test Menu',
                categories:     [{ categoryId: 'cat-1', name: 'Entrees', items: [itemId] }],
                lastUpdateTime: '2025-01-01T00:00:00.000Z',
            },
        ],
        availableAt: { open: '7:00 AM', close: '3:00 PM' },
    };

    const item: FixtureItem = {
        id:             itemId,
        amount:         '9.99',
        displayText:    'No Customization',
        properties:     { calories: '500', maxCalories: '500' },
        lastUpdateTime: '2025-01-01T00:00:00.000Z',
        // Explicit `false` means the cafe does not support modifiers for
        // this item. The code must skip the modifier fetch entirely.
        isItemCustomizationEnabled: false,
        receiptText:    'NO CUST',
        priceLevels:    defaultPriceLevels('9.99'),
        // Even though we populate _modifiers, the fetch should be skipped,
        // so they should never end up on the returned item.
        _modifiers:     defaultModifiers(itemId),
    };

    ctx.server.setFixture(CAFE_ID, 'stations', [station]);
    ctx.server.setFixture(CAFE_ID, 'menu-items', [item]);

    const result = await CafeMenuSession.retrieveMenuAsync(CAFE, 0);

    const stationResult = findStation(result.stations, stationId);
    const menuItem = stationResult.menuItemsById.get(itemId);
    assert.ok(menuItem, 'item should be present in menuItemsById');
    assert.equal(
        menuItem.modifiers.length,
        0,
        `expected no modifiers when isItemCustomizationEnabled is false (got ${menuItem.modifiers.length})`,
    );
});

test('item with missing isItemCustomizationEnabled flag is treated as unknown and still fetches modifiers (2ca0ec9)', async () => {
    ctx.installServices();
    const stationId = '2ca0ec9-b-station';
    const menuId = '2ca0ec9-b-menu';
    const itemId = '2ca0ec9-b-item-missing-flag';

    const station: FixtureStation = {
        id:   stationId,
        name: 'Test Station B',
        priceLevelConfig: { menuId },
        menus: [
            {
                id:             menuId,
                name:           'Test Menu B',
                categories:     [{ categoryId: 'cat-1', name: 'Entrees', items: [itemId] }],
                lastUpdateTime: '2025-01-01T00:00:00.000Z',
            },
        ],
        availableAt: { open: '7:00 AM', close: '3:00 PM' },
    };

    // No isItemCustomizationEnabled field set at all. The code must NOT
    // treat the missing flag as `false` — it should still fetch modifiers.
    const item: FixtureItem = {
        id:             itemId,
        amount:         '11.50',
        displayText:    'Unknown Customization',
        properties:     { calories: '600', maxCalories: '600' },
        lastUpdateTime: '2025-01-01T00:00:00.000Z',
        receiptText:    'UNK CUST',
        priceLevels:    defaultPriceLevels('11.50'),
        _modifiers:     defaultModifiers(itemId),
    };

    ctx.server.setFixture(CAFE_ID, 'stations', [station]);
    ctx.server.setFixture(CAFE_ID, 'menu-items', [item]);

    const result = await CafeMenuSession.retrieveMenuAsync(CAFE, 0);

    const stationResult = findStation(result.stations, stationId);
    const menuItem = stationResult.menuItemsById.get(itemId);
    assert.ok(menuItem, 'item should be present in menuItemsById');
    assert.equal(menuItem.modifiers.length, 1, 'should have fetched modifiers despite the missing flag');
    assert.equal(menuItem.modifiers[0]!.id, `${itemId}-mod-0`);
    assert.equal(menuItem.modifiers[0]!.choices.length, 2);
});

test('items missing from menuItemsById are filtered out of category lists (72f929e)', async () => {
    ctx.installServices();
    const stationId = '72f929e-station';
    const menuId = '72f929e-menu';
    const realItemA = '72f929e-real-a';
    const realItemB = '72f929e-real-b';
    const phantomItem = '72f929e-phantom-id-not-in-menu-items';

    const station: FixtureStation = {
        id:   stationId,
        name: 'Filter Station',
        priceLevelConfig: { menuId },
        menus: [
            {
                id:         menuId,
                name:       'Filter Menu',
                categories: [
                    {
                        categoryId: 'cat-1',
                        name:       'Entrees',
                        items:      [realItemA, phantomItem, realItemB],
                    },
                    {
                        categoryId: 'cat-2',
                        name:       'Sides',
                        items:      [phantomItem],
                    },
                ],
                lastUpdateTime: '2025-01-01T00:00:00.000Z',
            },
        ],
        availableAt: { open: '7:00 AM', close: '3:00 PM' },
    };

    // menu-items fixture deliberately omits `phantomItem` — the cafe API
    // sometimes lists items in a category that aren't actually returned by
    // /kiosk-items/get-items. Those phantom IDs must be filtered out, or
    // uniqueness / overview computations downstream break.
    const items: FixtureItem[] = [realItemA, realItemB].map((id, i) => ({
        id,
        amount:         `${i + 1}.00`,
        displayText:    `Real Item ${i + 1}`,
        properties:     { calories: '100', maxCalories: '100' },
        lastUpdateTime: '2025-01-01T00:00:00.000Z',
        receiptText:    `REAL ${i + 1}`,
        priceLevels:    defaultPriceLevels(`${i + 1}.00`),
    }));

    ctx.server.setFixture(CAFE_ID, 'stations', [station]);
    ctx.server.setFixture(CAFE_ID, 'menu-items', items);

    const result = await CafeMenuSession.retrieveMenuAsync(CAFE, 0);

    const stationResult = findStation(result.stations, stationId);

    // The real items are present in menuItemsById; the phantom is not.
    assert.ok(stationResult.menuItemsById.has(realItemA), 'realItemA should be present');
    assert.ok(stationResult.menuItemsById.has(realItemB), 'realItemB should be present');
    assert.ok(!stationResult.menuItemsById.has(phantomItem), 'phantom should be absent from menuItemsById');

    // Entrees should be filtered down to just the two real items (in their
    // original order minus the phantom).
    const entrees = stationResult.menuItemIdsByCategoryName.get('Entrees');
    assert.ok(entrees, 'Entrees category should still exist');
    assert.deepEqual(entrees, [realItemA, realItemB], 'phantom should have been filtered out of Entrees');

    // Sides only contained the phantom — after filtering it must be empty,
    // and the category itself should be dropped from the station.
    assert.ok(
        !stationResult.menuItemIdsByCategoryName.has('Sides'),
        'Sides category should be dropped because all of its items were phantom',
    );
});

test('missing local modifiers default to [] when no local item exists (127170b)', async () => {
    ctx.installServices();
    // First sync of a brand-new item: there's no local DB row, so
    // localItem is undefined throughout. The result must always have
    // modifiers as an array (never undefined / null), even when the
    // modifier fetch ultimately returns nothing.
    const stationId = '127170b-fresh-station';
    const menuId = '127170b-fresh-menu';
    const itemId = '127170b-fresh-item';

    const station: FixtureStation = {
        id:   stationId,
        name: 'Fresh Station',
        priceLevelConfig: { menuId },
        menus: [
            {
                id:             menuId,
                name:           'Fresh Menu',
                categories:     [{ categoryId: 'cat-1', name: 'Entrees', items: [itemId] }],
                lastUpdateTime: '2025-01-01T00:00:00.000Z',
            },
        ],
        availableAt: { open: '7:00 AM', close: '3:00 PM' },
    };

    const item: FixtureItem = {
        id:             itemId,
        amount:         '5.00',
        displayText:    'No Modifiers Item',
        properties:     { calories: '100', maxCalories: '100' },
        lastUpdateTime: '2025-01-01T00:00:00.000Z',
        receiptText:    'NO MOD',
        priceLevels:    defaultPriceLevels('5.00'),
        // No _modifiers and no isItemCustomizationEnabled — fetch goes
        // through but the response has no modifier block. The retrieval
        // helper returns []; the caller must not crash on that.
    };

    ctx.server.setFixture(CAFE_ID, 'stations', [station]);
    ctx.server.setFixture(CAFE_ID, 'menu-items', [item]);

    const result = await CafeMenuSession.retrieveMenuAsync(CAFE, 0);

    const stationResult = findStation(result.stations, stationId);
    const menuItem = stationResult.menuItemsById.get(itemId);
    assert.ok(menuItem, 'item should be present in menuItemsById');
    assert.ok(Array.isArray(menuItem.modifiers), 'modifiers must always be an array');
    assert.equal(menuItem.modifiers.length, 0);
});

test('modifier fetch failure falls back to [] instead of throwing (127170b)', async () => {
    ctx.installServices();
    // Inject a 500 on the per-item kiosk-items/:itemId endpoint. The code
    // catches and logs the error, then returns []. Without the `?? []`
    // safety net, downstream code would dereference null/undefined.
    const stationId = '127170b-fail-station';
    const menuId = '127170b-fail-menu';
    const itemId = '127170b-fail-item';

    const station: FixtureStation = {
        id:   stationId,
        name: 'Failing Station',
        priceLevelConfig: { menuId },
        menus: [
            {
                id:             menuId,
                name:           'Failing Menu',
                categories:     [{ categoryId: 'cat-1', name: 'Entrees', items: [itemId] }],
                lastUpdateTime: '2025-01-01T00:00:00.000Z',
            },
        ],
        availableAt: { open: '7:00 AM', close: '3:00 PM' },
    };

    const item: FixtureItem = {
        id:             itemId,
        amount:         '8.00',
        displayText:    'Failing Modifier Item',
        properties:     { calories: '300', maxCalories: '300' },
        lastUpdateTime: '2025-01-01T00:00:00.000Z',
        // Customization is enabled, so the code WILL try to fetch — and the
        // fetch will hit our injected failure.
        isItemCustomizationEnabled: true,
        receiptText:    'FAIL MOD',
        priceLevels:    defaultPriceLevels('8.00'),
        _modifiers:     defaultModifiers(itemId),
    };

    ctx.server.setFixture(CAFE_ID, 'stations', [station]);
    ctx.server.setFixture(CAFE_ID, 'menu-items', [item]);

    // Match the per-item detail endpoint, not the list endpoint:
    // POST /sites/:tenantId/:contextId/kiosk-items/<itemId>
    const detailPathPattern = new RegExp(`/kiosk-items/${itemId}$`);
    ctx.server.injectFailure({
        method:      'POST',
        pathPattern: detailPathPattern,
        statusCode:  500,
        body:        'simulated upstream failure',
    });

    try {
        const result = await CafeMenuSession.retrieveMenuAsync(CAFE, 0);

        const stationResult = findStation(result.stations, stationId);
        const menuItem = stationResult.menuItemsById.get(itemId);
        assert.ok(menuItem, 'item should still be present even when modifier fetch fails');
        assert.ok(Array.isArray(menuItem.modifiers), 'modifiers must be an array even when fetch fails');
        assert.equal(menuItem.modifiers.length, 0, 'modifiers should default to [] on fetch failure');
    } finally {
        ctx.server.clearFailures();
    }
});

test('valid modifier fetch populates the returned item with the modifier data (127170b)', async () => {
    ctx.installServices();
    // Companion to the "default to []" tests above: confirm that when the
    // fetch succeeds, the resulting modifiers actually reflect the server
    // payload (i.e. the safety net doesn't accidentally drop real data).
    const stationId = '127170b-success-station';
    const menuId = '127170b-success-menu';
    const itemId = '127170b-success-item';

    const station: FixtureStation = {
        id:   stationId,
        name: 'Success Station',
        priceLevelConfig: { menuId },
        menus: [
            {
                id:             menuId,
                name:           'Success Menu',
                categories:     [{ categoryId: 'cat-1', name: 'Entrees', items: [itemId] }],
                lastUpdateTime: '2025-01-01T00:00:00.000Z',
            },
        ],
        availableAt: { open: '7:00 AM', close: '3:00 PM' },
    };

    const item: FixtureItem = {
        id:             itemId,
        amount:         '12.00',
        displayText:    'Item With Modifiers',
        properties:     { calories: '400', maxCalories: '400' },
        lastUpdateTime: '2025-01-01T00:00:00.000Z',
        isItemCustomizationEnabled: true,
        receiptText:    'WITH MOD',
        priceLevels:    defaultPriceLevels('12.00'),
        _modifiers:     defaultModifiers(itemId),
    };

    ctx.server.setFixture(CAFE_ID, 'stations', [station]);
    ctx.server.setFixture(CAFE_ID, 'menu-items', [item]);

    const result = await CafeMenuSession.retrieveMenuAsync(CAFE, 0);
    const stationResult = findStation(result.stations, stationId);
    const menuItem = stationResult.menuItemsById.get(itemId);
    assert.ok(menuItem);
    assert.equal(menuItem.modifiers.length, 1);
    assert.equal(menuItem.modifiers[0]!.id, `${itemId}-mod-0`);
    assert.equal(menuItem.modifiers[0]!.choices.length, 2);
    assert.deepEqual(
        menuItem.modifiers[0]!.choices.map(c => c.description).sort(),
        ['Ranch', 'Vinaigrette'],
    );
});
