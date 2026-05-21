/**
 * End-to-end tests for the Cart data service.
 *
 * Covers CRUD, normalized modifiers, active-order locking,
 * and the unified cart+activeOrder response shape.
 */

import { after, before, test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../../../../tests/test-server/integration-test-context.js';
import { getServices } from '../../../../main/services/registry.js';
import { cartService } from '../../../../main/services/data/cart.js';
import { usePrismaWrite } from '../client.js';

let ctx: IntegrationTestContext;

const USER_ID = 'cart-test-user';
const MENU_ITEM_ID = 'cart-test-menu-item';
const MENU_ITEM_ID_2 = 'cart-test-menu-item-2';

before(async () => {
    ctx = await createIntegrationTestContext();
    ctx.installServices();

    // Seed user, cafe, station, menu items for FK constraints
    await usePrismaWrite(async prisma => {
        await prisma.user.create({
            data: { id: USER_ID, externalId: 'cart-ext', provider: 'test', displayName: 'Cart Tester' },
        });
        await prisma.cafe.create({
            data: {
                id: 'cart-cafe', name: 'Cart Café', tenantId: 't', contextId: 'c',
                displayProfileId: 'd', storeId: 's', externalName: 'e',
            },
        });
        await prisma.station.create({
            data: {
                id: 'cart-station', name: 'Cart Station', menuId: 'menu-1',
                cafeId: 'cart-cafe', normalizedName: 'cart station',
            },
        });
        await prisma.menuItem.create({
            data: {
                id: MENU_ITEM_ID, name: 'Test Burger', normalizedName: 'test burger',
                calories: 500, maxCalories: 500, price: 9.99,
                cafeId: 'cart-cafe', stationId: 'cart-station',
            },
        });
        await prisma.menuItem.create({
            data: {
                id: MENU_ITEM_ID_2, name: 'Test Salad', normalizedName: 'test salad',
                calories: 200, maxCalories: 200, price: 7.50,
                cafeId: 'cart-cafe', stationId: 'cart-station',
            },
        });
    });
});

after(async () => {
    await ctx.cleanup();
});

test('services.data.cart is the typed client', () => {
    ctx.installServices();
    assert.equal(getServices().data.cart, cartService);
});

test('getCart returns empty cart for new user', async () => {
    ctx.installServices();
    const cart = await getServices().data.cart.getCart({ userId: USER_ID });
    assert.deepEqual(cart.items, []);
    assert.equal(cart.activeOrder, undefined);
});

test('addItem + getCart round-trip with normalized modifiers', async () => {
    ctx.installServices();

    const result = await getServices().data.cart.addItem({
        userId: USER_ID,
        item: {
            menuItemId: MENU_ITEM_ID,
            quantity:   2,
            modifiers:  [{ modifierId: 'mod-1', choiceIds: ['choice-a', 'choice-b'] }],
        },
    });

    assert.equal(result.items.length, 1);
    const item = result.items[0]!;
    assert.equal(item.menuItemId, MENU_ITEM_ID);
    assert.equal(item.quantity, 2);
    assert.deepEqual(item.modifiers, [{ modifierId: 'mod-1', choiceIds: ['choice-a', 'choice-b'] }]);
    assert.equal(item.specialInstructions, null);
    assert.ok(item.id, 'should have a server-generated UUID');

    const fetched = await getServices().data.cart.getCart({ userId: USER_ID });
    assert.equal(fetched.items.length, 1);
    assert.equal(fetched.items[0]!.id, item.id);
});

test('addItem with specialInstructions', async () => {
    ctx.installServices();

    const result = await getServices().data.cart.addItem({
        userId: USER_ID,
        item: {
            menuItemId:          MENU_ITEM_ID_2,
            quantity:            1,
            specialInstructions: 'No onions please',
            modifiers:           [],
        },
    });

    const added = result.items.find(i => i.menuItemId === MENU_ITEM_ID_2);
    assert.ok(added);
    assert.equal(added.specialInstructions, 'No onions please');
});

test('updateItem changes quantity and modifiers', async () => {
    ctx.installServices();

    const cart = await getServices().data.cart.getCart({ userId: USER_ID });
    const itemToUpdate = cart.items.find(i => i.menuItemId === MENU_ITEM_ID);
    assert.ok(itemToUpdate);

    const result = await getServices().data.cart.updateItem({
        userId: USER_ID,
        itemId: itemToUpdate.id,
        update: {
            quantity:  5,
            modifiers: [{ modifierId: 'mod-2', choiceIds: ['choice-c'] }],
        },
    });

    const updated = result.items.find(i => i.id === itemToUpdate.id);
    assert.ok(updated);
    assert.equal(updated.quantity, 5);
    assert.deepEqual(updated.modifiers, [{ modifierId: 'mod-2', choiceIds: ['choice-c'] }]);
});

test('updateItem for nonexistent item throws NOT_FOUND', async () => {
    ctx.installServices();

    await assert.rejects(
        () => getServices().data.cart.updateItem({
            userId: USER_ID,
            itemId: 'nonexistent-id',
            update: { quantity: 1 },
        }),
        (err: any) => err.code === 'NOT_FOUND',
    );
});

test('removeItem removes a specific item', async () => {
    ctx.installServices();

    const cart = await getServices().data.cart.getCart({ userId: USER_ID });
    const countBefore = cart.items.length;
    assert.ok(countBefore > 0);

    const itemToRemove = cart.items[0]!;
    const result = await getServices().data.cart.removeItem({
        userId: USER_ID,
        itemId: itemToRemove.id,
    });

    assert.equal(result.items.length, countBefore - 1);
    assert.ok(!result.items.some(i => i.id === itemToRemove.id));
});

test('removeItem for nonexistent item throws NOT_FOUND', async () => {
    ctx.installServices();

    await assert.rejects(
        () => getServices().data.cart.removeItem({
            userId: USER_ID,
            itemId: 'nonexistent-id',
        }),
        (err: any) => err.code === 'NOT_FOUND',
    );
});

test('clearCart removes all items', async () => {
    ctx.installServices();

    // Ensure there's at least one item
    await getServices().data.cart.addItem({
        userId: USER_ID,
        item: { menuItemId: MENU_ITEM_ID, quantity: 1, modifiers: [] },
    });

    const result = await getServices().data.cart.clearCart({ userId: USER_ID });
    assert.deepEqual(result.items, []);
});

test('cart mutations reject with CONFLICT when an active order exists', async () => {
    ctx.installServices();

    // Create an active order session directly in the DB
    await usePrismaWrite(async prisma => {
        await prisma.orderSession.create({
            data: {
                userId: USER_ID,
                cafeParts: {
                    create: {
                        cafeId: 'cart-cafe',
                        status: 'payment_pending',
                    },
                },
            },
        });
    });

    // All mutations should be rejected
    const item = { menuItemId: MENU_ITEM_ID, quantity: 1, modifiers: [] };

    await assert.rejects(
        () => getServices().data.cart.addItem({ userId: USER_ID, item }),
        (err: any) => err.code === 'CONFLICT',
    );
    await assert.rejects(
        () => getServices().data.cart.updateItem({ userId: USER_ID, itemId: 'x', update: { quantity: 1 } }),
        (err: any) => err.code === 'CONFLICT',
    );
    await assert.rejects(
        () => getServices().data.cart.removeItem({ userId: USER_ID, itemId: 'x' }),
        (err: any) => err.code === 'CONFLICT',
    );
    await assert.rejects(
        () => getServices().data.cart.clearCart({ userId: USER_ID }),
        (err: any) => err.code === 'CONFLICT',
    );

    // getCart should still work and include the activeOrder
    const cart = await getServices().data.cart.getCart({ userId: USER_ID });
    assert.ok(cart.activeOrder);
    assert.equal(cart.activeOrder.cafeParts.length, 1);
    assert.equal(cart.activeOrder.cafeParts[0]!.status, 'payment_pending');
});
