/**
 * Integration test for `7bd9abe` — modifier choices can legitimately share
 * the same choice ID across different modifiers ("Choices can be shared
 * across modifiers apparently"). The original bug threw a unique-constraint
 * error in that case; the fix made the choice primary key compound:
 *
 *     model MenuItemModifierChoice {
 *         id          String  // not globally unique
 *         modifierId  String
 *         @@id([id, modifierId])
 *     }
 *
 * This test exercises the round-trip through the real save code:
 *   - Boot once to populate cafe25 normally (baseline).
 *   - Mutate cafe25's menu-items fixture to add two items whose modifiers
 *     deliberately use overlapping choice IDs.
 *   - Re-sync. The save must succeed and persist both modifier→choice
 *     rows (one per [choiceId, modifierId] pair) without dropping or
 *     conflating either modifier's choices.
 */

import { after, before, mock, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { DateUtil } from '@msdining/common';
import { CafeMenuSession } from '../../worker/data/cafe/session/menu.js';
import { saveDailyMenuAsync } from '../../worker/data/cafe/job/storage.js';
import { usePrismaClient } from '../../worker/data/storage/client.js';
import { DailyMenuStorageClient } from '../../worker/data/storage/clients/daily-menu/daily-menu.js';
import { ALL_CAFES } from '../../shared/constants/cafes.js';
import { ICafe } from '../../shared/models/cafe.js';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../test-server/integration-test-context.js';

const CAFE_ID = 'cafe25';
const FAKE_NOW = new Date('2026-05-13T12:00:00Z'); // Wednesday

// Two items whose modifiers will share choice IDs.
const ITEM_A_ID = 'shared-choice-test-item-a';
const ITEM_B_ID = 'shared-choice-test-item-b';
const MODIFIER_A_ID = 'shared-choice-test-mod-a';
const MODIFIER_B_ID = 'shared-choice-test-mod-b';
const SHARED_CHOICE_IDS = ['shared-choice-small', 'shared-choice-medium', 'shared-choice-large'] as const;

let ctx: IntegrationTestContext;
let cafe: ICafe;
let todayString: string;

interface MenuItemFixture {
    id: string;
    amount: string;
    displayText: string;
    properties: Record<string, string>;
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

interface StationFixture {
    id: string;
    menus: Array<{ categories: Array<{ items: string[] }> }>;
}

const buildSharedChoiceItem = (
    itemId: string,
    modifierId: string,
    displayText: string,
): MenuItemFixture => ({
    id: itemId,
    amount: '5.00',
    displayText,
    properties: { calories: '100', maxCalories: '150' },
    description: 'Test item for shared-choice modifier regression test.',
    lastUpdateTime: '2026-05-01T00:00:00.000Z',
    isItemCustomizationEnabled: true,
    receiptText: displayText.toUpperCase().slice(0, 16),
    tagIds: [],
    priceLevels: {
        'pl-1': {
            priceLevelId: 'pl-1',
            name: 'Default',
            price: { currencyUnit: 'USD', amount: '5.00' },
        },
    },
    _modifiers: {
        modifiers: [
            {
                id: modifierId,
                description: 'Size',
                minimum: 1,
                maximum: 1,
                type: 'radio',
                options: SHARED_CHOICE_IDS.map((choiceId, index) => ({
                    id: choiceId,
                    description: ['Small', 'Medium', 'Large'][index]!,
                    amount: '0.00',
                })),
            },
        ],
    },
});

const resyncCafe = async (): Promise<void> => {
    const result = await CafeMenuSession.retrieveMenuAsync(cafe, 0);
    await DailyMenuStorageClient.upsertDailyCafeAsync(cafe.id, todayString, {
        isAvailable: true,
        shutdownMessageHash: null,
    });
    await saveDailyMenuAsync({
        cafe,
        dateString: todayString,
        isAvailable: true,
        stations: result.stations,
        shouldUpdateExistingItems: true,
    });
};

before(async () => {
    mock.timers.enable({ apis: ['Date'], now: FAKE_NOW });
    todayString = DateUtil.toDateString(new Date());

    ctx = await createIntegrationTestContext();

    const found = ALL_CAFES.find((c) => c.id === CAFE_ID);
    assert.ok(found, `${CAFE_ID} should exist in ALL_CAFES`);
    cafe = found;

    // First sync — baseline. After this, cafe25's existing modifier rows
    // are in the DB and we have a known starting point.
    await resyncCafe();
}, { timeout: 60_000 });

after(async () => {
    await ctx.cleanup();
    mock.timers.reset();
});

test('re-sync succeeds when two modifiers share the same choice IDs', async () => {
    // Mutate the fixture: append two items that have modifiers using an
    // overlapping set of choice IDs. The save code must accept this and
    // not violate any unique constraint.
    const items = ctx.server.state.getFixture<MenuItemFixture[]>(CAFE_ID, 'menu-items') ?? [];
    const stations = ctx.server.state.getFixture<StationFixture[]>(CAFE_ID, 'stations') ?? [];

    const augmentedItems: MenuItemFixture[] = [
        ...items,
        buildSharedChoiceItem(ITEM_A_ID, MODIFIER_A_ID, 'Shared Choice Item A'),
        buildSharedChoiceItem(ITEM_B_ID, MODIFIER_B_ID, 'Shared Choice Item B'),
    ];

    // Place both new items into the first station's first category so they
    // get returned by /concepts and then fetched by /kiosk-items/get-items.
    const augmentedStations = stations.map((station, stationIndex) => {
        if (stationIndex !== 0) {
            return station;
        }
        return {
            ...station,
            menus: station.menus.map((menu, menuIndex) => {
                if (menuIndex !== 0) {
                    return menu;
                }
                return {
                    ...menu,
                    categories: menu.categories.map((category, catIndex) => {
                        if (catIndex !== 0) {
                            return category;
                        }
                        return {
                            ...category,
                            items: [...category.items, ITEM_A_ID, ITEM_B_ID],
                        };
                    }),
                };
            }),
        };
    });

    ctx.server.setFixture(CAFE_ID, 'menu-items', augmentedItems);
    ctx.server.setFixture(CAFE_ID, 'stations', augmentedStations);

    // The bug under regression would throw a Prisma unique-constraint
    // error inside saveDailyMenuAsync → _doCreateModifierChoiceAsync.
    // Asserting "no throw" is the central assertion.
    await resyncCafe();
});

test('both modifiers were persisted with their full choice sets', async () => {
    const modifiers = await usePrismaClient((client) =>
        client.menuItemModifier.findMany({
            where: { id: { in: [MODIFIER_A_ID, MODIFIER_B_ID] } },
            include: { choices: true },
            orderBy: { id: 'asc' },
        }),
    );

    assert.equal(modifiers.length, 2, `expected both modifiers persisted; got ${modifiers.length}`);

    for (const modifier of modifiers) {
        const choiceIds = new Set(modifier.choices.map((c) => c.id));
        assert.equal(
            choiceIds.size,
            SHARED_CHOICE_IDS.length,
            `modifier ${modifier.id} should have ${SHARED_CHOICE_IDS.length} choices; got ${choiceIds.size} (${[...choiceIds].join(', ')})`,
        );
        for (const expected of SHARED_CHOICE_IDS) {
            assert.ok(
                choiceIds.has(expected),
                `modifier ${modifier.id} should contain choice "${expected}"`,
            );
        }
    }
});

test('shared choice IDs are stored once per modifier (composite key)', async () => {
    // For each shared choice ID, there should be exactly one row per
    // modifier — total = SHARED_CHOICE_IDS.length × 2 modifiers.
    const rows = await usePrismaClient((client) =>
        client.menuItemModifierChoice.findMany({
            where: {
                id: { in: [...SHARED_CHOICE_IDS] },
                modifierId: { in: [MODIFIER_A_ID, MODIFIER_B_ID] },
            },
        }),
    );

    assert.equal(
        rows.length,
        SHARED_CHOICE_IDS.length * 2,
        `expected ${SHARED_CHOICE_IDS.length * 2} choice rows (one per [id, modifierId] pair); got ${rows.length}`,
    );

    // Sanity: every (id, modifierId) pair must be unique.
    const pairs = new Set(rows.map((r) => `${r.id}|${r.modifierId}`));
    assert.equal(pairs.size, rows.length, 'choice rows must be unique by [id, modifierId]');
});

test('both injected menu items are linked to their respective modifiers', async () => {
    const items = await usePrismaClient((client) =>
        client.menuItem.findMany({
            where: { id: { in: [ITEM_A_ID, ITEM_B_ID] } },
            include: { modifiers: { include: { modifier: true } } },
        }),
    );

    assert.equal(items.length, 2, `both test items should be saved (got ${items.length})`);

    const itemA = items.find((i) => i.id === ITEM_A_ID);
    const itemB = items.find((i) => i.id === ITEM_B_ID);
    assert.ok(itemA, `item ${ITEM_A_ID} should exist`);
    assert.ok(itemB, `item ${ITEM_B_ID} should exist`);
    assert.deepEqual(itemA.modifiers.map((m) => m.modifierId), [MODIFIER_A_ID]);
    assert.deepEqual(itemB.modifiers.map((m) => m.modifierId), [MODIFIER_B_ID]);
});
