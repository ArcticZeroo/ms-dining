/**
 * Integration tests for DailyMenuStorageClient and the daily-uniqueness cache.
 *
 * Regression targets:
 *   - `c860a02` — items with duplicate normalized names at the same station
 *     were counted twice in the uniqueness/appearance calculation. The fix
 *     keeps a per-station `seenItemNames` set so duplicates count once.
 *     (The uniqueness calc has since moved from daily-menu.ts to
 *     api/cache/daily-uniqueness.ts but the dedup contract is the same.)
 *   - `e60c31c` — the daily-station retrieval query was using `include` in a
 *     shape that dropped fields needed to reconstruct an ICafeStation. The
 *     fix switched to a `select` that includes stationId + every field the
 *     hydrator needs.
 */

import { after, before, beforeEach, mock, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { DailyMenuStorageClient } from './daily-menu.js';
import { MenuItemStorageClient } from '../menu-item/menu-item.js';
import { CafeStorageClient } from '../cafe/cafe.js';
import { usePrismaWrite } from '../../client.js';
import { retrieveItemAppearancesForCafe } from '../../../cache/daily-uniqueness.js';
import { ALL_CAFES } from '../../../../../shared/constants/cafes.js';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../../../../../tests/test-server/integration-test-context.js';
import { toDateString, getMondayForWeek } from '@msdining/common/util/date-util';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';

let ctx: IntegrationTestContext;

// Pin "now" to a known Monday so the menu-window weekday checks always pass.
// Pick a Monday far enough out to remain "today ± 30 days" stable.
const FAKE_NOW = new Date('2026-05-11T12:00:00Z'); // Monday
const TODAY_DATE_STRING = toDateString(FAKE_NOW);

before(async () => {
    ctx = await createIntegrationTestContext();
});

after(async () => {
    await ctx.cleanup();
});

beforeEach(async () => {
    // Each test seeds its own data. Clean the DB between tests.
    // Cascade delete from Cafe takes care of MenuItem, Station, DailyCafe,
    // DailyStation, DailyCategory, DailyMenuItem.
    await usePrismaWrite(prisma => prisma.cafe.deleteMany({}));
    CafeStorageClient.resetCache();
});

// ─── Helpers ────────────────────────────────────────────────────────────────

const seedCafe = (id: string, name: string) =>
    usePrismaWrite(prisma => prisma.cafe.create({
        data: {
            id,
            name,
            tenantId:         't-' + id,
            contextId:        'ctx-' + id,
            displayProfileId: 'dp-' + id,
            storeId:          's-' + id,
            externalName:     name,
            logoName:         null,
        },
    }));

const seedStation = (id: string, cafeId: string, name: string, opts: { groupId?: string | null; logoUrl?: string | null; opensAt?: number; closesAt?: number } = {}) =>
    usePrismaWrite(prisma => prisma.station.create({
        data: {
            id,
            cafeId,
            name,
            normalizedName: normalizeNameForSearch(name),
            menuId:         'menu-' + id,
            logoUrl:        opts.logoUrl ?? null,
            groupId:        opts.groupId ?? null,
            opensAt:        opts.opensAt ?? 660,
            closesAt:       opts.closesAt ?? 840,
        },
    }));

const seedMenuItem = (id: string, cafeId: string, stationId: string, name: string) =>
    usePrismaWrite(prisma => prisma.menuItem.create({
        data: {
            id,
            cafeId,
            stationId,
            name,
            normalizedName: normalizeNameForSearch(name),
            description:    null,
            imageUrl:       null,
            tags:           null,
            calories:       0,
            maxCalories:    0,
            price:          1.0,
        },
    }));

interface SeedDailyStationParams {
    cafeId: string;
    dateString: string;
    stationId: string;
    /** Map of category name → menuItemIds (order preserved). */
    itemsByCategory: Map<string, string[]>;
}

const seedDailyStation = async ({ cafeId, dateString, stationId, itemsByCategory }: SeedDailyStationParams) => {
    await usePrismaWrite(prisma => prisma.dailyCafe.upsert({
        where:  { dateString_cafeId: { dateString, cafeId } },
        update: {},
        create: { dateString, cafeId, isAvailable: true },
    }));

    const snapshotId = `snapshot-${stationId}-${dateString}`;
    await usePrismaWrite(prisma => prisma.stationMenuSnapshot.create({
        data: {
            id:        snapshotId,
            stationId,
            categories: {
                create: Array.from(itemsByCategory.entries()).map(([categoryName, menuItemIds]) => ({
                    name:      categoryName,
                    menuItems: {
                        create: menuItemIds.map(menuItemId => ({
                            menuItemId,
                        })),
                    },
                })),
            },
        },
    }));

    await usePrismaWrite(prisma => prisma.dailyStation.create({
        data: { cafeId, dateString, stationId, snapshotId },
    }));
};

// ─── e60c31c — retrieveDailyMenuAsync shape ────────────────────────────────

test('retrieveDailyMenuAsync returns stationId + categories with all fields populated', async () => {
    const cafeId = 'test-cafe-shape';
    const stationId = 'test-station-shape';
    await seedCafe(cafeId, 'Shape Cafe');
    await seedStation(stationId, cafeId, 'Grill Station', { logoUrl: 'http://example.com/logo.png', opensAt: 600, closesAt: 900 });
    await seedMenuItem('m1', cafeId, stationId, 'Burger');
    await seedMenuItem('m2', cafeId, stationId, 'Hot Dog');
    await seedMenuItem('m3', cafeId, stationId, 'Fries');

    const dateString = TODAY_DATE_STRING;
    await seedDailyStation({
        cafeId,
        dateString,
        stationId,
        itemsByCategory: new Map([
            ['Entrees', ['m1', 'm2']],
            ['Sides', ['m3']],
        ]),
    });

    const stations = await DailyMenuStorageClient.retrieveDailyMenuAsync(cafeId, dateString);

    assert.equal(stations.length, 1, 'should reconstruct exactly one ICafeStation');
    const station = stations[0]!;

    // ── Top-level ICafeStation fields ──
    assert.equal(station.id, stationId, 'stationId must round-trip');
    assert.equal(station.cafeId, cafeId);
    assert.equal(station.name, 'Grill Station');
    assert.equal(station.menuId, 'menu-' + stationId);
    assert.equal(station.logoUrl, 'http://example.com/logo.png');
    assert.equal(station.opensAt, 600);
    assert.equal(station.closesAt, 900);
    assert.equal(station.groupId, null);

    // ── Categories ──
    assert.equal(station.menuItemIdsByCategoryName.size, 2);
    assert.deepEqual(station.menuItemIdsByCategoryName.get('Entrees'), ['m1', 'm2']);
    assert.deepEqual(station.menuItemIdsByCategoryName.get('Sides'), ['m3']);

    // ── Items hydrated through MenuItemStorageClient ──
    assert.equal(station.menuItemsById.size, 3);
    assert.equal(station.menuItemsById.get('m1')?.name, 'Burger');
    assert.equal(station.menuItemsById.get('m2')?.name, 'Hot Dog');
    assert.equal(station.menuItemsById.get('m3')?.name, 'Fries');
});

test('retrieveDailyMenuAsync preserves the station groupId from the underlying Station row', async () => {
    const cafeId = 'test-cafe-group';
    const stationId = 'test-station-group';
    // Create a CrossCafeGroup so the FK is valid.
    const group = await usePrismaWrite(prisma => prisma.crossCafeGroup.create({
        data: { name: 'Diner', entityType: 'station' },
    }));

    await seedCafe(cafeId, 'Group Cafe');
    await seedStation(stationId, cafeId, 'Diner', { groupId: group.id });
    await seedMenuItem('m1', cafeId, stationId, 'Pancakes');

    await seedDailyStation({
        cafeId,
        dateString: TODAY_DATE_STRING,
        stationId,
        itemsByCategory: new Map([['Breakfast', ['m1']]]),
    });

    const stations = await DailyMenuStorageClient.retrieveDailyMenuAsync(cafeId, TODAY_DATE_STRING);
    assert.equal(stations.length, 1);
    assert.equal(stations[0]!.groupId, group.id, 'groupId must be selected and round-tripped');
});

test('retrieveDailyMenuAsync returns an empty array for a date with no daily stations', async () => {
    const cafeId = 'test-cafe-empty';
    await seedCafe(cafeId, 'Empty');

    const stations = await DailyMenuStorageClient.retrieveDailyMenuAsync(cafeId, TODAY_DATE_STRING);
    assert.deepEqual(stations, []);
});

// ─── c860a02 — duplicate item names count once per station ─────────────────

test('duplicate item names at the same station count once in the appearance calc (regression c860a02)', async (testContext) => {
    // The cache is keyed off CAFES_BY_ID — only known cafes have a cache slot.
    // Use a real cafe id (cafe25) so retrieveDailyCafeMenuAsync resolves.
    const cafe = ALL_CAFES.find(cafeCandidate => cafeCandidate.id === 'cafe25');
    assert.ok(cafe, 'cafe25 should exist');
    const cafeId = cafe.id;

    // Pin the clock so canFetchMenuForDateString() accepts our date (within
    // window and not a weekend) and "today" lands on a Monday for the week math.
    mock.timers.enable({ apis: ['Date'], now: FAKE_NOW });
    testContext.after(() => mock.timers.reset());

    const mondayString = toDateString(getMondayForWeek(FAKE_NOW));

    const stationId = 'sta-dup';
    const otherStationId = 'sta-other';

    await seedCafe(cafeId, 'Cafe 25');
    await seedStation(stationId, cafeId, 'Deli');
    await seedStation(otherStationId, cafeId, 'Grill');

    // At "Deli": two items with the SAME normalized name + one unique item.
    await seedMenuItem('item-sandwich-1', cafeId, stationId, 'Sandwich');
    await seedMenuItem('item-sandwich-2', cafeId, stationId, 'Sandwich'); // duplicate name
    await seedMenuItem('item-soup',       cafeId, stationId, 'Soup');

    // At "Grill": ONE item that happens to share a name with a Deli item.
    await seedMenuItem('item-grill-soup', cafeId, otherStationId, 'Soup');

    await seedDailyStation({
        cafeId,
        dateString: mondayString,
        stationId,
        itemsByCategory: new Map([
            ['Mains', ['item-sandwich-1', 'item-sandwich-2', 'item-soup']],
        ]),
    });
    await seedDailyStation({
        cafeId,
        dateString: mondayString,
        stationId: otherStationId,
        itemsByCategory: new Map([
            ['Mains', ['item-grill-soup']],
        ]),
    });

    const appearancesByStation = await retrieveItemAppearancesForCafe(cafeId, mondayString);

    const sandwichNorm = normalizeNameForSearch('Sandwich');
    const soupNorm = normalizeNameForSearch('Soup');

    const deliCounts = appearancesByStation.get('Deli');
    assert.ok(deliCounts, 'Deli station should have appearance counts');
    assert.equal(
        deliCounts.get(sandwichNorm),
        1,
        'duplicate-named items at the same station must count exactly once (regression: c860a02)',
    );
    assert.equal(deliCounts.get(soupNorm), 1, 'unique item at Deli counts once');

    // Same item name at a *different* station counts separately for that station.
    const grillCounts = appearancesByStation.get('Grill');
    assert.ok(grillCounts, 'Grill station should have appearance counts');
    assert.equal(
        grillCounts.get(soupNorm),
        1,
        'same normalized name at a different station gets its own count',
    );
});

// ─── Empty categories are excluded from retrieveDailyMenuAsync ──────────────

test('retrieveDailyMenuAsync omits empty categories from the result', async () => {
    const cafeId = 'test-cafe-empty-cat';
    const stationId = 'test-station-empty-cat';
    await seedCafe(cafeId, 'Empty Cat Cafe');
    await seedStation(stationId, cafeId, 'Mixed Station');
    await seedMenuItem('m-real', cafeId, stationId, 'Real Item');

    await seedDailyStation({
        cafeId,
        dateString: TODAY_DATE_STRING,
        stationId,
        itemsByCategory: new Map([
            ['Has Items', ['m-real']],
            ['Empty Category', []],
        ]),
    });

    const stations = await DailyMenuStorageClient.retrieveDailyMenuAsync(cafeId, TODAY_DATE_STRING);
    assert.equal(stations.length, 1);
    const station = stations[0]!;

    assert.equal(station.menuItemIdsByCategoryName.size, 1, 'empty category should be filtered out');
    assert.ok(station.menuItemIdsByCategoryName.has('Has Items'));
    assert.ok(!station.menuItemIdsByCategoryName.has('Empty Category'), 'empty category must not appear');
});

// Ensure no other test in this file leaks the MenuItemStorageClient's
// in-process cache across tests. The static class caches by id so a fresh id
// per test is sufficient — we already use distinct ids above.
void MenuItemStorageClient;
