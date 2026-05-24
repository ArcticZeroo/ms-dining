/**
 * End-to-end tests for the Cart data service.
 *
 * Covers CRUD and normalized modifiers.
 */

import { after, before, test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../../../../../tests/test-server/integration-test-context.js';
import { getServices } from '../../../../../main/services/registry.js';
import { cartService } from '../../../../../main/services/data/cart.js';
import { usePrismaWrite } from '../../client.js';

let ctx: IntegrationTestContext;

const USER_ID = 'cart-test-user';
const MENU_ITEM_ID = 'cart-test-menu-item';
const MENU_ITEM_ID_2 = 'cart-test-menu-item-2';

before(async () => {
    ctx = await createIntegrationTestContext();

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
    assert.equal(getServices().data.cart, cartService);
});

test('getCart returns empty cart for new user', async () => {
    const cart = await getServices().data.cart.getCart({ userId: USER_ID });
    assert.deepEqual(cart.items, []);
});

test('addItems + getCart round-trip with normalized modifiers', async () => {

    const result = await getServices().data.cart.addItems({
        userId: USER_ID,
        items: [{
            menuItemId: MENU_ITEM_ID,
            quantity:   2,
            modifiers:  [{ modifierId: 'mod-1', choiceIds: ['choice-a', 'choice-b'] }],
        }],
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

test('addItems with specialInstructions', async () => {
    const result = await getServices().data.cart.addItems({
        userId: USER_ID,
        items: [{
            menuItemId:          MENU_ITEM_ID_2,
            quantity:            1,
            specialInstructions: 'No onions please',
            modifiers:           [],
        }],
    });

    const added = result.items.find(i => i.menuItemId === MENU_ITEM_ID_2);
    assert.ok(added);
    assert.equal(added.specialInstructions, 'No onions please');
});

test('updateItem changes quantity, instructions, and modifiers', async () => {

    const beforeUpdate = await getServices().data.cart.addItems({
        userId: USER_ID,
        items: [{
            menuItemId: MENU_ITEM_ID,
            quantity:   1,
            modifiers:  [{ modifierId: 'mod-old', choiceIds: ['a'] }],
        }],
    });

    const target = beforeUpdate.items[beforeUpdate.items.length - 1]!;

    const result = await getServices().data.cart.updateItem({
        userId: USER_ID,
        itemId: target.id,
        update: {
            quantity:            3,
            specialInstructions: 'Extra crispy',
            modifiers:           [{ modifierId: 'mod-new', choiceIds: ['x', 'y'] }],
        },
    });

    const updated = result.items.find(i => i.id === target.id);
    assert.ok(updated);
    assert.equal(updated.quantity, 3);
    assert.equal(updated.specialInstructions, 'Extra crispy');
    assert.deepEqual(updated.modifiers, [{ modifierId: 'mod-new', choiceIds: ['x', 'y'] }]);
});

test('updateItem rejects missing item', async () => {

    await assert.rejects(
        () => getServices().data.cart.updateItem({
            userId: USER_ID,
            itemId: 'does-not-exist',
            update: { quantity: 2, modifiers: [], specialInstructions: null },
        }),
        (err: any) => err.code === 'NOT_FOUND',
    );
});

test('removeItem deletes one item and returns remaining cart', async () => {

    const result = await getServices().data.cart.addItems({
        userId: USER_ID,
        items: [{ menuItemId: MENU_ITEM_ID_2, quantity: 1, modifiers: [] }],
    });
    const target = result.items[result.items.length - 1]!;

    const afterRemove = await getServices().data.cart.removeItem({ userId: USER_ID, itemId: target.id });
    assert.ok(!afterRemove.items.some(i => i.id === target.id));
});

test('removeItem rejects missing item', async () => {

    await assert.rejects(
        () => getServices().data.cart.removeItem({ userId: USER_ID, itemId: 'does-not-exist' }),
        (err: any) => err.code === 'NOT_FOUND',
    );
});

test('clearCart removes all items', async () => {

    await getServices().data.cart.addItems({
        userId: USER_ID,
        items: [{ menuItemId: MENU_ITEM_ID, quantity: 1, modifiers: [] }],
    });

    const result = await getServices().data.cart.clearCart({ userId: USER_ID });
    assert.deepEqual(result.items, []);
});

test('cart mutations remain available without active-order locking', async () => {

    const added = await getServices().data.cart.addItems({
        userId: USER_ID,
        items: [{ menuItemId: MENU_ITEM_ID, quantity: 1, modifiers: [] }],
    });
    const target = added.items[0]!;

    const updated = await getServices().data.cart.updateItem({
        userId: USER_ID,
        itemId: target.id,
        update: { quantity: 2, modifiers: [], specialInstructions: null },
    });
    assert.equal(updated.items.find(item => item.id === target.id)?.quantity, 2);

    const removed = await getServices().data.cart.removeItem({ userId: USER_ID, itemId: target.id });
    assert.ok(!removed.items.some(item => item.id === target.id));
});
