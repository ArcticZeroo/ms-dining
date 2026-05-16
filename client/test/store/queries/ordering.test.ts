import * as assert from 'node:assert';
import { describe, it } from 'vitest';
import { CartItemsByCafeId } from '../../../src/models/cart.ts';
import { cartHashForKey } from '../../../src/store/queries/ordering.ts';
import { makeCartItem, makeMenuItem } from '../fixtures.ts';

const cartOf = (...items: ReturnType<typeof makeCartItem>[]): CartItemsByCafeId => {
    const cart: CartItemsByCafeId = new Map();
    for (const item of items) {
        let cafeItems = cart.get(item.cafeId);
        if (!cafeItems) {
            cafeItems = new Map();
            cart.set(item.cafeId, cafeItems);
        }
        cafeItems.set(item.id, item);
    }
    return cart;
};

describe('cartHashForKey', () => {
    it('produces the empty string for an empty cart', () => {
        assert.strictEqual(cartHashForKey(new Map()), '');
    });

    it('is stable across cart-map insertion order', () => {
        const a = makeCartItem({ id: 'a', associatedItem: makeMenuItem({ cafeId: 'cafe-a', id: 'item-a' }) });
        const b = makeCartItem({ id: 'b', associatedItem: makeMenuItem({ cafeId: 'cafe-b', id: 'item-b' }) });

        const cart1 = cartOf(a, b);
        const cart2 = cartOf(b, a);

        assert.strictEqual(cartHashForKey(cart1), cartHashForKey(cart2));
    });

    it('is stable across item-map insertion order within a cafe', () => {
        const a = makeCartItem({ id: 'a', associatedItem: makeMenuItem({ id: 'item-a' }) });
        const b = makeCartItem({ id: 'b', associatedItem: makeMenuItem({ id: 'item-b' }) });

        const cart1 = cartOf(a, b);
        const cart2 = cartOf(b, a);

        assert.strictEqual(cartHashForKey(cart1), cartHashForKey(cart2));
    });

    it('is stable across modifier-id insertion order', () => {
        const choices1 = new Map<string, Set<string>>([
            ['mod-a', new Set(['choice-1'])],
            ['mod-b', new Set(['choice-2'])],
        ]);
        const choices2 = new Map<string, Set<string>>([
            ['mod-b', new Set(['choice-2'])],
            ['mod-a', new Set(['choice-1'])],
        ]);

        const cart1 = cartOf(makeCartItem({ choicesByModifierId: choices1 }));
        const cart2 = cartOf(makeCartItem({ choicesByModifierId: choices2 }));

        assert.strictEqual(cartHashForKey(cart1), cartHashForKey(cart2));
    });

    it('is stable across choice-set insertion order', () => {
        const cart1 = cartOf(makeCartItem({
            choicesByModifierId: new Map([['mod', new Set(['a', 'b', 'c'])]]),
        }));
        const cart2 = cartOf(makeCartItem({
            choicesByModifierId: new Map([['mod', new Set(['c', 'a', 'b'])]]),
        }));

        assert.strictEqual(cartHashForKey(cart1), cartHashForKey(cart2));
    });

    it('changes when quantity changes', () => {
        const cart1 = cartOf(makeCartItem({ quantity: 1 }));
        const cart2 = cartOf(makeCartItem({ quantity: 2 }));

        assert.notStrictEqual(cartHashForKey(cart1), cartHashForKey(cart2));
    });

    it('changes when special instructions change', () => {
        const cart1 = cartOf(makeCartItem({ specialInstructions: 'no onions' }));
        const cart2 = cartOf(makeCartItem({ specialInstructions: 'extra onions' }));

        assert.notStrictEqual(cartHashForKey(cart1), cartHashForKey(cart2));
    });

    it('changes when itemId changes', () => {
        const cart1 = cartOf(makeCartItem({ associatedItem: makeMenuItem({ id: 'item-a' }) }));
        const cart2 = cartOf(makeCartItem({ associatedItem: makeMenuItem({ id: 'item-b' }) }));

        assert.notStrictEqual(cartHashForKey(cart1), cartHashForKey(cart2));
    });

    it('changes when modifier choices differ', () => {
        const cart1 = cartOf(makeCartItem({
            choicesByModifierId: new Map([['mod', new Set(['a'])]]),
        }));
        const cart2 = cartOf(makeCartItem({
            choicesByModifierId: new Map([['mod', new Set(['b'])]]),
        }));

        assert.notStrictEqual(cartHashForKey(cart1), cartHashForKey(cart2));
    });

    it('ignores volatile fields like cart-item id and price', () => {
        const cart1 = cartOf(makeCartItem({ id: 'random-uuid-1', price: 9.99 }));
        const cart2 = cartOf(makeCartItem({ id: 'random-uuid-2', price: 0 }));

        assert.strictEqual(cartHashForKey(cart1), cartHashForKey(cart2));
    });
});
