import * as assert from 'node:assert';
import { beforeEach, describe, it } from 'vitest';
import { CartItemsByCafeId } from '../../../src/models/cart.ts';
import { serializeCartForPersistence, useCartStore } from '../../../src/store/zustand/cart.ts';
import { makeCartItem, makeMenuItem, makeSerializedItem, makeSerializedModifier } from '../fixtures.ts';

const resetCartStore = () => {
    useCartStore.setState({ items: new Map(), missingItemsByCafeId: new Map() });
};

describe('useCartStore', () => {
    beforeEach(resetCartStore);

    describe('addOrEditItem', () => {
        it('adds an item to an empty cart', () => {
            const item = makeCartItem();
            useCartStore.getState().addOrEditItem(item);

            const cafeItems = useCartStore.getState().items.get(item.cafeId);
            assert.strictEqual(cafeItems?.size, 1);
            assert.strictEqual(cafeItems?.get(item.id), item);
        });

        it('updates an existing item in place (same id)', () => {
            const item = makeCartItem({ quantity: 1 });
            useCartStore.getState().addOrEditItem(item);
            useCartStore.getState().addOrEditItem({ ...item, quantity: 3 });

            const updated = useCartStore.getState().items.get(item.cafeId)?.get(item.id);
            assert.strictEqual(updated?.quantity, 3);
            assert.strictEqual(useCartStore.getState().items.get(item.cafeId)?.size, 1);
        });

        it('coexists with another item from the same cafe', () => {
            const itemA = makeCartItem({ id: 'cart-item-a' });
            const itemB = makeCartItem({ id: 'cart-item-b' });
            useCartStore.getState().addOrEditItem(itemA);
            useCartStore.getState().addOrEditItem(itemB);

            assert.strictEqual(useCartStore.getState().items.get(itemA.cafeId)?.size, 2);
        });

        it('keeps items from different cafes separate', () => {
            const itemA = makeCartItem({ id: 'cart-item-a', cafeId: 'cafe-a' });
            const itemB = makeCartItem({ id: 'cart-item-b', cafeId: 'cafe-b' });
            useCartStore.getState().addOrEditItem(itemA);
            useCartStore.getState().addOrEditItem(itemB);

            assert.strictEqual(useCartStore.getState().items.size, 2);
            assert.strictEqual(useCartStore.getState().items.get('cafe-a')?.size, 1);
            assert.strictEqual(useCartStore.getState().items.get('cafe-b')?.size, 1);
        });
    });

    describe('removeItem', () => {
        it('removes the item from its cafe', () => {
            const itemA = makeCartItem({ id: 'cart-item-a' });
            const itemB = makeCartItem({ id: 'cart-item-b' });
            useCartStore.getState().addOrEditItem(itemA);
            useCartStore.getState().addOrEditItem(itemB);

            useCartStore.getState().removeItem(itemA);

            const cafeItems = useCartStore.getState().items.get(itemA.cafeId);
            assert.strictEqual(cafeItems?.size, 1);
            assert.strictEqual(cafeItems?.has(itemB.id), true);
        });

        it('deletes the cafe entry when removing the last item', () => {
            const item = makeCartItem();
            useCartStore.getState().addOrEditItem(item);

            useCartStore.getState().removeItem(item);

            assert.strictEqual(useCartStore.getState().items.has(item.cafeId), false);
        });

        it('is a no-op for an unknown cafe', () => {
            const item = makeCartItem({ cafeId: 'never-added' });
            useCartStore.getState().removeItem(item);

            assert.strictEqual(useCartStore.getState().items.size, 0);
        });
    });

    describe('removeCafe', () => {
        it('removes every item from the cafe', () => {
            useCartStore.getState().addOrEditItem(makeCartItem({ id: 'a' }));
            useCartStore.getState().addOrEditItem(makeCartItem({ id: 'b' }));

            useCartStore.getState().removeCafe('cafe-1');

            assert.strictEqual(useCartStore.getState().items.has('cafe-1'), false);
        });
    });

    describe('removeMissingItemAt', () => {
        const itemA = makeSerializedItem({ itemId: 'item-a' });
        const itemB = makeSerializedItem({ itemId: 'item-b' });

        it('removes the entry at the given index but preserves the rest under the same cafe', () => {
            useCartStore.getState().setMissingItems(new Map([['cafe-1', [itemA, itemB]]]));

            useCartStore.getState().removeMissingItemAt('cafe-1', 0);

            const remaining = useCartStore.getState().missingItemsByCafeId.get('cafe-1');
            assert.strictEqual(remaining?.length, 1);
            assert.strictEqual(remaining?.[0]?.itemId, 'item-b');
        });

        it('deletes the cafe entry when removing the last item', () => {
            useCartStore.getState().setMissingItems(new Map([['cafe-1', [itemA]]]));

            useCartStore.getState().removeMissingItemAt('cafe-1', 0);

            assert.strictEqual(useCartStore.getState().missingItemsByCafeId.has('cafe-1'), false);
        });

        it('is a no-op for an unknown cafe', () => {
            useCartStore.getState().removeMissingItemAt('cafe-1', 0);

            assert.strictEqual(useCartStore.getState().missingItemsByCafeId.size, 0);
        });

        it('is a no-op for an out-of-bounds index', () => {
            useCartStore.getState().setMissingItems(new Map([['cafe-1', [itemA]]]));

            useCartStore.getState().removeMissingItemAt('cafe-1', 5);

            assert.strictEqual(useCartStore.getState().missingItemsByCafeId.get('cafe-1')?.length, 1);
        });
    });

    describe('clearMissingItems', () => {
        it('empties the map', () => {
            useCartStore.getState().setMissingItems(new Map([['cafe-1', [makeSerializedItem()]]]));

            useCartStore.getState().clearMissingItems();

            assert.strictEqual(useCartStore.getState().missingItemsByCafeId.size, 0);
        });
    });
});

describe('serializeCartForPersistence', () => {
    it('serializes live items including modifiers and special instructions', () => {
        const choices = new Map<string, Set<string>>([['mod-1', new Set(['choice-a', 'choice-b'])]]);
        const cart: CartItemsByCafeId = new Map([
            ['cafe-1', new Map([
                ['cart-item-1', {
                    id:                  'cart-item-1',
                    cafeId:              'cafe-1',
                    itemId:              'menu-item-1',
                    quantity:            2,
                    price:               7.5,
                    specialInstructions: 'no onions',
                    choicesByModifierId: choices,
                    associatedItem:      makeMenuItem({ id: 'menu-item-1', name: 'Burger' }),
                }],
            ])],
        ]);

        const result = serializeCartForPersistence(cart, new Map());

        assert.deepStrictEqual(result, {
            'cafe-1': [
                {
                    itemId:              'menu-item-1',
                    name:                'Burger',
                    quantity:            2,
                    modifiers:           [makeSerializedModifier('mod-1', ['choice-a', 'choice-b'])],
                    specialInstructions: 'no onions',
                },
            ],
        });
    });

    it('appends missing items to the live items for the same cafe', () => {
        const cart: CartItemsByCafeId = new Map([
            ['cafe-1', new Map([['cart-item-1', makeCartItem({ associatedItem: makeMenuItem({ name: 'Live' }) })]])],
        ]);
        const missing = new Map([['cafe-1', [makeSerializedItem({ itemId: 'm-1', name: 'Missing' })]]]);

        const result = serializeCartForPersistence(cart, missing);

        assert.strictEqual(result['cafe-1']?.length, 2);
        assert.strictEqual(result['cafe-1']?.[0]?.name, 'Live');
        assert.strictEqual(result['cafe-1']?.[1]?.name, 'Missing');
    });

    it('preserves cafes that only have missing items (regression: missing-items wipe)', () => {
        const missing = new Map([['cafe-only-missing', [makeSerializedItem({ itemId: 'm-1' })]]]);

        const result = serializeCartForPersistence(new Map(), missing);

        assert.strictEqual(result['cafe-only-missing']?.length, 1);
        assert.strictEqual(result['cafe-only-missing']?.[0]?.itemId, 'm-1');
    });

    it('does not overwrite live items when a cafe has both live and missing entries', () => {
        const cart: CartItemsByCafeId = new Map([
            ['cafe-1', new Map([['cart-item-1', makeCartItem()]])],
        ]);
        const missing = new Map([['cafe-1', []]]);

        const result = serializeCartForPersistence(cart, missing);

        assert.strictEqual(result['cafe-1']?.length, 1);
    });

    it('returns an empty object for empty inputs', () => {
        assert.deepStrictEqual(serializeCartForPersistence(new Map(), new Map()), {});
    });
});
