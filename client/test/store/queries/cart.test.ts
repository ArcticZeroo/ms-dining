import * as assert from 'node:assert';
import { describe, it } from 'vitest';
import { CartItemsByCafeId } from '../../../src/models/cart.ts';
import { mergeHydratedItems } from '../../../src/store/queries/cart.ts';
import { makeCartItem } from '../fixtures.ts';

const cartOf = (...items: ReturnType<typeof makeCartItem>[]): CartItemsByCafeId => {
    const cart: CartItemsByCafeId = new Map();
    for (const item of items) {
        let bucket = cart.get(item.cafeId);
        if (!bucket) {
            bucket = new Map();
            cart.set(item.cafeId, bucket);
        }
        bucket.set(item.id, item);
    }
    return cart;
};

describe('mergeHydratedItems', () => {
    it('returns an empty cart when both sides are empty', () => {
        assert.strictEqual(mergeHydratedItems(new Map(), new Map()).size, 0);
    });

    it('returns hydrated items as-is when current is empty', () => {
        const hydrated = cartOf(makeCartItem({ id: 'a' }));
        const result = mergeHydratedItems(new Map(), hydrated);
        assert.strictEqual(result.get('cafe-1')?.size, 1);
        assert.strictEqual(result.get('cafe-1')?.get('a')?.id, 'a');
    });

    it('preserves items added during hydration when current has entries', () => {
        const added = cartOf(makeCartItem({ id: 'added-during-hydration' }));
        const hydrated = cartOf(makeCartItem({ id: 'from-boot' }));

        const result = mergeHydratedItems(added, hydrated);

        const cafeItems = result.get('cafe-1');
        assert.strictEqual(cafeItems?.size, 2);
        assert.strictEqual(cafeItems?.has('added-during-hydration'), true);
        assert.strictEqual(cafeItems?.has('from-boot'), true);
    });

    it('does not mutate either input', () => {
        const added = cartOf(makeCartItem({ id: 'added' }));
        const hydrated = cartOf(makeCartItem({ id: 'boot' }));

        mergeHydratedItems(added, hydrated);

        assert.strictEqual(added.get('cafe-1')?.size, 1);
        assert.strictEqual(added.get('cafe-1')?.has('boot'), false);
        assert.strictEqual(hydrated.get('cafe-1')?.size, 1);
    });

    it('merges separate cafes from both sides', () => {
        const added = cartOf(makeCartItem({ id: 'a', cafeId: 'cafe-a' }));
        const hydrated = cartOf(makeCartItem({ id: 'b', cafeId: 'cafe-b' }));

        const result = mergeHydratedItems(added, hydrated);

        assert.strictEqual(result.size, 2);
        assert.strictEqual(result.get('cafe-a')?.size, 1);
        assert.strictEqual(result.get('cafe-b')?.size, 1);
    });

    it('hydrated items overwrite current items with the same id (refresh of stale boot data)', () => {
        // Pathological but defensive: if an id collision somehow occurs, the
        // hydrated copy is authoritative because it came back from the server
        // with the latest server-side menu metadata.
        const current = cartOf(makeCartItem({ id: 'shared', quantity: 1 }));
        const hydrated = cartOf(makeCartItem({ id: 'shared', quantity: 3 }));

        const result = mergeHydratedItems(current, hydrated);

        assert.strictEqual(result.get('cafe-1')?.get('shared')?.quantity, 3);
    });
});
