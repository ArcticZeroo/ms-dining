/**
 * Regression tests for SearchManager — commits 8948cc7 + 11bc67d.
 *
 * 8948cc7 ("Fix search description bug"): when the first menu item to land
 * in a search-result bucket had no description/imageUrl but a later item
 * matched against the same bucket carried real data, the SearchResults
 * bucket kept the empty values forever. SearchResults.addResult was
 * updated to unconditionally backfill description/imageUrl on every call:
 *   searchResult.description = searchResult.description || description;
 *   searchResult.imageUrl    = searchResult.imageUrl    || imageUrl;
 * The same commit also tweaked normalizeNameForSearch so that "The X" and
 * "X" produce the same key — which is what allows two items to land in the
 * same bucket in the first place.
 *
 * 11bc67d ("Don't return cheap search results without calories"): the
 * /search/cheap pipeline ranks by calories-per-dollar. Items with
 * calories === 0 && maxCalories === 0 were ranked alongside real items
 * and produced meaningless results. The fix excludes them outright in
 * SearchManager.searchForCheapItems before they reach the result map.
 *
 * Approach:
 *   - Pure unit assertions on normalizeNameForSearch for "the X" parity.
 *   - Integration assertions that drive the real SearchManager.search and
 *     SearchManager.searchForCheapItems entrypoints against seeded data in
 *     the temp Prisma DB created by createIntegrationTestContext.
 */

import { after, before, describe, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { DateUtil } from '@msdining/common';
import { SearchEntityType } from '@msdining/common/models/search';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import { SearchManager } from './search.js';
import { usePrismaWrite } from './client.js';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../../test-server/integration-test-context.js';

const FAKE_NOW = new Date('2026-05-13T12:00:00Z'); // Wednesday — middle of the week
const TODAY = DateUtil.toDateString(FAKE_NOW);

// Use IDs that don't collide with real ALL_CAFES entries so the seed
// stays isolated and the test doesn't accidentally exercise unrelated
// production data paths.
const CAFE_ID = 'search-test-cafe';
const STATION_ID = 'search-test-station';
const GROUP_ID = 'search-test-group';

interface ISeedMenuItem {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    price: number;
    calories: number;
    maxCalories: number;
    groupId: string | null;
}

const seedSearchableMenu = async (items: ISeedMenuItem[]): Promise<void> => {
    await usePrismaWrite(async (client) => {
        // Cafe + Station rows are FK targets for MenuItem and DailyStation.
        await client.cafe.upsert({
            where:  { id: CAFE_ID },
            update: {},
            create: {
                id:               CAFE_ID,
                name:             'Search Test Cafe',
                tenantId:         't',
                contextId:        'c',
                displayProfileId: 'dp',
            },
        });

        await client.station.upsert({
            where:  { id: STATION_ID },
            update: {},
            create: {
                id:             STATION_ID,
                name:           'Test Station',
                normalizedName: normalizeNameForSearch('Test Station'),
                menuId:         'menu-1',
                cafeId:         CAFE_ID,
            },
        });

        // CrossCafeGroup is the FK target for MenuItem.groupId. Without it
        // the items can't share a search-result bucket.
        await client.crossCafeGroup.upsert({
            where:  { id: GROUP_ID },
            update: {},
            create: {
                id:         GROUP_ID,
                name:       'Search Test Group',
                entityType: SearchEntityType.menuItem,
            },
        });

        // DailyCafe must exist before DailyStation (composite FK).
        await client.dailyCafe.upsert({
            where:  { dateString_cafeId: { dateString: TODAY, cafeId: CAFE_ID } },
            update: { isAvailable: true, shutdownMessageHash: null },
            create: {
                dateString:          TODAY,
                cafeId:              CAFE_ID,
                isAvailable:         true,
                shutdownMessageHash: null,
            },
        });

        // Fresh DailyStation per seed call. We don't keep state between
        // tests; deleting first guarantees deterministic insertion order.
        await client.dailyStation.deleteMany({
            where: { cafeId: CAFE_ID, dateString: TODAY },
        });

        const dailyStation = await client.dailyStation.create({
            data: {
                cafeId:     CAFE_ID,
                dateString: TODAY,
                stationId:  STATION_ID,
            },
        });

        const dailyCategory = await client.dailyCategory.create({
            data: {
                name:      'Test Category',
                stationId: dailyStation.id,
            },
        });

        for (const item of items) {
            await client.menuItem.upsert({
                where:  { id: item.id },
                update: {
                    name:           item.name,
                    normalizedName: normalizeNameForSearch(item.name),
                    description:    item.description,
                    imageUrl:       item.imageUrl,
                    price:          item.price,
                    calories:       item.calories,
                    maxCalories:    item.maxCalories,
                    groupId:        item.groupId,
                    cafeId:         CAFE_ID,
                    stationId:      STATION_ID,
                },
                create: {
                    id:             item.id,
                    name:           item.name,
                    normalizedName: normalizeNameForSearch(item.name),
                    description:    item.description,
                    imageUrl:       item.imageUrl,
                    price:          item.price,
                    calories:       item.calories,
                    maxCalories:    item.maxCalories,
                    groupId:        item.groupId,
                    cafeId:         CAFE_ID,
                    stationId:      STATION_ID,
                },
            });

            await client.dailyMenuItem.create({
                data: {
                    menuItemId: item.id,
                    categoryId: dailyCategory.id,
                },
            });
        }
    });
};

let ctx: IntegrationTestContext;

before(async () => {
    ctx = await createIntegrationTestContext();
}, { timeout: 60_000 });

after(async () => {
    await ctx.cleanup();
});

describe('normalizeNameForSearch — "the X" / "X" parity (8948cc7)', () => {
    // The fix also added `.replace(/^the /i, '')` to normalizeNameForSearch
    // so that menu items named "The Burger" and "Burger" collide into the
    // same search-result bucket. The bucket collision is the prerequisite
    // for the description-backfill behavior tested below.

    test('lowercase "the X" normalizes to "X"', () => {
        assert.equal(
            normalizeNameForSearch('the burger'),
            normalizeNameForSearch('burger'),
        );
    });

    test('Title-case "The X" normalizes to "X"', () => {
        assert.equal(
            normalizeNameForSearch('The Burger'),
            normalizeNameForSearch('burger'),
        );
    });

    test('only the leading "the " is stripped, not interior occurrences', () => {
        // "Catch the Sun Salad" should keep "the" inside the name.
        // Result is "catchthesunsalad", not "catchsunsalad".
        assert.equal(
            normalizeNameForSearch('Catch the Sun Salad'),
            'catchthesunsalad',
        );
    });

    test('items differing only by leading "the" share a search key', () => {
        // This is the bucket-collision precondition that lets later-matched
        // items backfill earlier-matched items' empty description.
        const a = normalizeNameForSearch('The Matcha Latte');
        const b = normalizeNameForSearch('Matcha Latte');
        assert.equal(a, b);
        assert.equal(a, 'matchalatte');
    });
});

describe('SearchManager.search — description/imageUrl backfill (8948cc7)', () => {
    test('a later-matched item backfills description from an earlier match that had none', async () => {
        // Two items in the same group → same search-result bucket.
        // First one inserted (and therefore iterated first by
        // _performMultiQuerySearch) has no description; second carries the
        // real description. Pre-fix, the bucket kept the empty description.
        // Post-fix, addResult does:
        //   searchResult.description = searchResult.description || description;
        // every call, so the second item's description backfills.
        await seedSearchableMenu([
            {
                id:          'matcha-empty',
                name:        'Matcha Latte',
                description: null,
                imageUrl:    null,
                price:       4.50,
                calories:    120,
                maxCalories: 120,
                groupId:     GROUP_ID,
            },
            {
                id:          'matcha-full',
                name:        'Matcha Latte',
                description: 'Premium ceremonial-grade matcha tea with steamed milk.',
                imageUrl:    'https://example.com/matcha.png',
                price:       4.50,
                calories:    120,
                maxCalories: 120,
                groupId:     GROUP_ID,
            },
        ]);

        const result = await SearchManager.search('matcha', FAKE_NOW);
        const menuItems = result.get(SearchEntityType.menuItem);
        assert.ok(menuItems, 'menuItem result map should exist');

        const grouped = menuItems.get(GROUP_ID);
        assert.ok(grouped,
            `expected a menuItem bucket keyed by group "${GROUP_ID}", got keys: ${[...menuItems.keys()].join(', ')}`);
        assert.equal(
            grouped.description,
            'Premium ceremonial-grade matcha tea with steamed milk.',
            'description from later-matched item must backfill the earlier empty one',
        );
    });

    test('does not crash when only the first-matched item has no description', async () => {
        // Single item, no description. Pre-fix this path could trip on
        // a later string-method call against the missing field; post-fix
        // the result simply carries description undefined/null.
        await seedSearchableMenu([
            {
                id:          'solo-no-desc',
                name:        'Solo Burger',
                description: null,
                imageUrl:    null,
                price:       6.00,
                calories:    500,
                maxCalories: 500,
                groupId:     null,
            },
        ]);

        const result = await SearchManager.search('solo burger', FAKE_NOW);
        const menuItems = result.get(SearchEntityType.menuItem);
        assert.ok(menuItems);

        // No groupId → key is `no-group-${normalizedName}`.
        const expectedKey = `no-group-${normalizeNameForSearch('Solo Burger')}`;
        const entry = menuItems.get(expectedKey);
        assert.ok(entry,
            `expected entry at key "${expectedKey}", got keys: ${[...menuItems.keys()].join(', ')}`);
        assert.equal(entry.name, 'Solo Burger');
        // Empty description should round-trip as null/undefined without
        // any backfill candidate; the assertion is "didn't throw".
        assert.ok(entry.description == null);
    });
});

describe('SearchManager.searchForCheapItems — exclude zero-calorie items (11bc67d)', () => {
    test('items with calories=0 && maxCalories=0 are excluded; items with calories are included', async () => {
        // Two cheap items at the same price. Pre-fix, both appeared in the
        // result (sorted by meaningless calories-per-dollar). Post-fix, only
        // the one with real calorie data appears.
        await seedSearchableMenu([
            {
                id:          'cheap-no-cals',
                name:        'Mystery Plate',
                description: null,
                imageUrl:    null,
                price:       5.00,
                calories:    0,
                maxCalories: 0,
                groupId:     null,
            },
            {
                id:          'cheap-real-cals',
                name:        'Cheeseburger Plate',
                description: null,
                imageUrl:    null,
                price:       5.00,
                calories:    600,
                maxCalories: 750,
                groupId:     null,
            },
        ]);

        const results = await SearchManager.searchForCheapItems({
            minPrice: 0,
            maxPrice: 100,
            date:     FAKE_NOW,
        });

        const resultNames = results.map(r => r.name);
        assert.ok(
            resultNames.includes('Cheeseburger Plate'),
            `expected "Cheeseburger Plate" in results, got: [${resultNames.join(', ')}]`,
        );
        assert.ok(
            !resultNames.includes('Mystery Plate'),
            `"Mystery Plate" has no calorie data and must be excluded, got: [${resultNames.join(', ')}]`,
        );
    });

    test('an item with only maxCalories set is kept (the exclusion needs both to be 0)', async () => {
        // The guard is `calories === 0 && maxCalories === 0`. An item with
        // a non-zero maxCalories still has rankable data and must survive.
        await seedSearchableMenu([
            {
                id:          'max-cals-only',
                name:        'Big Sandwich Combo',
                description: null,
                imageUrl:    null,
                price:       7.50,
                calories:    0,
                maxCalories: 800,
                groupId:     null,
            },
        ]);

        const results = await SearchManager.searchForCheapItems({
            minPrice: 0,
            maxPrice: 100,
            date:     FAKE_NOW,
        });

        const sandwich = results.find(r => r.name === 'Big Sandwich Combo');
        assert.ok(
            sandwich,
            `item with maxCalories=800 must be retained; got: [${results.map(r => r.name).join(', ')}]`,
        );
    });

    test('existing NON_ENTREE_FILTER still excludes drinks (regression for filter ordering)', async () => {
        // The calorie guard was added inside the existing filter loop. This
        // test makes sure the older NON_ENTREE_FILTER text filter still
        // runs — "Matcha Latte" matches the drink filter and should never
        // appear in cheap results even though it has real calorie data.
        await seedSearchableMenu([
            {
                id:          'drink-with-cals',
                name:        'Matcha Latte',
                description: 'Premium matcha',
                imageUrl:    null,
                price:       4.50,
                calories:    120,
                maxCalories: 200,
                groupId:     null,
            },
            {
                id:          'food-with-cals',
                name:        'Spicy Chicken Sandwich',
                description: null,
                imageUrl:    null,
                price:       6.00,
                calories:    550,
                maxCalories: 700,
                groupId:     null,
            },
        ]);

        const results = await SearchManager.searchForCheapItems({
            minPrice: 0,
            maxPrice: 100,
            date:     FAKE_NOW,
        });
        const names = results.map(r => r.name);
        assert.ok(
            !names.includes('Matcha Latte'),
            `drink filter must still exclude "Matcha Latte", got: [${names.join(', ')}]`,
        );
        assert.ok(
            names.includes('Spicy Chicken Sandwich'),
            `entree must remain in results, got: [${names.join(', ')}]`,
        );
    });

    test('price range filter still applies (regression for price + calorie composition)', async () => {
        await seedSearchableMenu([
            {
                id:          'too-cheap',
                name:        'Penny Wrap',
                description: null,
                imageUrl:    null,
                price:       0.50,
                calories:    300,
                maxCalories: 300,
                groupId:     null,
            },
            {
                id:          'in-range',
                name:        'Veggie Wrap',
                description: null,
                imageUrl:    null,
                price:       5.00,
                calories:    400,
                maxCalories: 400,
                groupId:     null,
            },
            {
                id:          'too-pricey',
                name:        'Lobster Wrap',
                description: null,
                imageUrl:    null,
                price:       25.00,
                calories:    500,
                maxCalories: 500,
                groupId:     null,
            },
        ]);

        const results = await SearchManager.searchForCheapItems({
            minPrice: 2,
            maxPrice: 10,
            date:     FAKE_NOW,
        });
        const names = results.map(r => r.name);
        assert.ok(names.includes('Veggie Wrap'));
        assert.ok(!names.includes('Penny Wrap'),
            'item below minPrice must be excluded');
        assert.ok(!names.includes('Lobster Wrap'),
            'item above maxPrice must be excluded');
    });
});
