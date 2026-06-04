import * as assert from 'node:assert';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { IPrepareCartResponse, OrderingClient } from '../../../src/api/order.ts';
import { CartItemsByCafeId } from '../../../src/models/cart.ts';
import { QUERY_CLIENT } from '../../../src/store/query-client.ts';
import {
    cartHashForKey,
    getFreshOrCachedCartSession,
    PAY_CLICK_CACHE_FRESHNESS_MS,
} from '../../../src/store/queries/ordering.ts';
import { queryKeys } from '../../../src/store/queries/keys.ts';
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

describe('getFreshOrCachedCartSession', () => {
    const fakeCart = cartOf(makeCartItem({ associatedItem: makeMenuItem({ cafeId: 'cafe-x' }) }));
    const fakeResponse: IPrepareCartResponse = {
        'cafe-x': {
            orderId:              'order-1',
            orderNumber:          '1001',
            totalPriceWithTax:    11.03,
            totalPriceWithoutTax: 9.99,
            totalTax:             1.04,
            waitTimeMin:          10,
            waitTimeMax:          15,
            expiresAt:            new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        },
    };

    beforeEach(() => {
        QUERY_CLIENT.clear();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
        QUERY_CLIENT.clear();
    });

    const seedCache = (dataUpdatedAt: number) => {
        const queryKey = [...queryKeys.ordering.cartSession, cartHashForKey(fakeCart)] as const;
        QUERY_CLIENT.setQueryData(queryKey, fakeResponse, { updatedAt: dataUpdatedAt });
    };

    it('returns cached data when it was fetched within the freshness window', async () => {
        const now = 1_700_000_000_000;
        vi.setSystemTime(now);
        seedCache(now - 30_000); // 30s old, < 60s default freshness

        const spy = vi.spyOn(OrderingClient, 'prepareCart').mockResolvedValue(fakeResponse);

        const result = await getFreshOrCachedCartSession(fakeCart);
        assert.strictEqual(result, fakeResponse);
        assert.strictEqual(spy.mock.calls.length, 0, 'should not refetch when cache is fresh');
    });

    it('refetches when cached data is older than the freshness window', async () => {
        const now = 1_700_000_000_000;
        vi.setSystemTime(now);
        seedCache(now - (PAY_CLICK_CACHE_FRESHNESS_MS + 1000));

        const refreshed: IPrepareCartResponse = { ...fakeResponse, 'cafe-x': { ...fakeResponse['cafe-x']!, orderId: 'order-2' } };
        const spy = vi.spyOn(OrderingClient, 'prepareCart').mockResolvedValue(refreshed);

        const result = await getFreshOrCachedCartSession(fakeCart);
        assert.strictEqual(result['cafe-x']?.orderId, 'order-2');
        assert.strictEqual(spy.mock.calls.length, 1, 'should refetch when cache is stale');
    });

    it('refetches when there is no cached entry at all', async () => {
        // No seedCache call — cache is empty.
        const spy = vi.spyOn(OrderingClient, 'prepareCart').mockResolvedValue(fakeResponse);

        const result = await getFreshOrCachedCartSession(fakeCart);
        assert.strictEqual(result, fakeResponse);
        assert.strictEqual(spy.mock.calls.length, 1);
    });

    it('respects an explicit freshnessMs override', async () => {
        const now = 1_700_000_000_000;
        vi.setSystemTime(now);
        seedCache(now - 90_000); // 90s old

        const spy = vi.spyOn(OrderingClient, 'prepareCart').mockResolvedValue(fakeResponse);

        // 120s window — 90s old is still fresh enough.
        await getFreshOrCachedCartSession(fakeCart, 120_000);
        assert.strictEqual(spy.mock.calls.length, 0);

        // 60s window — 90s old is stale, refetch.
        await getFreshOrCachedCartSession(fakeCart, 60_000);
        assert.strictEqual(spy.mock.calls.length, 1);
    });
});
