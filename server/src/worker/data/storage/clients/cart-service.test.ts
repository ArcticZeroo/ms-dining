/**
 * End-to-end tests for the Cart data service.
 *
 * Drives `services.data.cart.*` through the InProcessHandler to
 * `cartServiceCommands` and finally to Prisma. Covers CRUD, active-order
 * locking, and the unified cart+activeOrder response shape.
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

before(async () => {
    ctx = await createIntegrationTestContext();
    ctx.installServices();

    // Seed a user for cart tests.
    await usePrismaWrite(prisma => prisma.user.create({
        data: {
            id:          USER_ID,
            externalId:  'cart-test-external',
            provider:    'test',
            displayName: 'Cart Tester',
        },
    }));
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

test('addItem + getCart round-trip', async () => {
    ctx.installServices();

    const result = await getServices().data.cart.addItem({
        userId: USER_ID,
        item: {
            cafeId:     'cafe-1',
            menuItemId: 'item-1',
            quantity:   2,
            modifiers:  [{ modifierId: 'mod-1', choiceIds: ['choice-a'] }],
        },
    });

    assert.equal(result.items.length, 1);
    const item = result.items[0]!;
    assert.equal(item.cafeId, 'cafe-1');
    assert.equal(item.menuItemId, 'item-1');
    assert.equal(item.quantity, 2);
    assert.deepEqual(item.modifiers, [{ modifierId: 'mod-1', choiceIds: ['choice-a'] }]);
    assert.equal(item.specialInstructions, null);
    assert.ok(item.id, 'should have a server-generated UUID');

    // getCart should return the same data
    const fetched = await getServices().data.cart.getCart({ userId: USER_ID });
    assert.equal(fetched.items.length, 1);
    assert.equal(fetched.items[0]!.id, item.id);
});

test('addItem with specialInstructions', async () => {
    ctx.installServices();

    const result = await getServices().data.cart.addItem({
        userId: USER_ID,
        item: {
            cafeId:              'cafe-1',
            menuItemId:          'item-2',
            quantity:            1,
            specialInstructions: 'No onions please',
            modifiers:           [],
        },
    });

    const added = result.items.find(i => i.menuItemId === 'item-2');
    assert.ok(added);
    assert.equal(added.specialInstructions, 'No onions please');
});

test('updateItem changes quantity and modifiers', async () => {
    ctx.installServices();

    const cart = await getServices().data.cart.getCart({ userId: USER_ID });
    const itemToUpdate = cart.items.find(i => i.menuItemId === 'item-1');
    assert.ok(itemToUpdate);

    const result = await getServices().data.cart.updateItem({
        userId: USER_ID,
        itemId: itemToUpdate.id,
        update: {
            quantity:  5,
            modifiers: [{ modifierId: 'mod-2', choiceIds: ['choice-b', 'choice-c'] }],
        },
    });

    const updated = result.items.find(i => i.id === itemToUpdate.id);
    assert.ok(updated);
    assert.equal(updated.quantity, 5);
    assert.deepEqual(updated.modifiers, [{ modifierId: 'mod-2', choiceIds: ['choice-b', 'choice-c'] }]);
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
        item: { cafeId: 'cafe-x', menuItemId: 'item-x', quantity: 1, modifiers: [] },
    });

    const result = await getServices().data.cart.clearCart({ userId: USER_ID });
    assert.deepEqual(result.items, []);
});

test('cart mutations reject with CONFLICT when an active order exists', async () => {
    ctx.installServices();

    // Create an active order directly in the DB
    await usePrismaWrite(async prisma => {
        await prisma.order.create({
            data: {
                userId: USER_ID,
                cafeOrders: {
                    create: {
                        cafeId: 'cafe-1',
                        status: 'payment_pending',
                    },
                },
            },
        });
    });

    // All mutations should be rejected
    const item = { cafeId: 'c', menuItemId: 'm', quantity: 1, modifiers: [] };

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
    assert.equal(cart.activeOrder.cafeOrders.length, 1);
    assert.equal(cart.activeOrder.cafeOrders[0]!.status, 'payment_pending');
});
