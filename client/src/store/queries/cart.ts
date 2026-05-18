import { useQuery } from '@tanstack/react-query';
import { OrderingClient } from '../../api/order.ts';
import { InternalSettings } from '../../constants/settings.ts';
import { useIsOnlineOrderingAllowed } from '../../hooks/cafe.ts';
import { CartItemsByCafeId, ISerializedCartItemsByCafeId, ISerializedCartItemWithName } from '../../models/cart.ts';
import { useCartStore } from '../zustand/cart.ts';
import { queryKeys } from './keys.ts';

const hasBootData = (data: ISerializedCartItemsByCafeId | null): data is ISerializedCartItemsByCafeId =>
    data != null && Object.keys(data).length > 0;

/**
 * Merges hydration-returned items into the existing live cart, preserving any
 * items the user added during the pending hydration window. Cart-item ids are
 * randomly minted both by add-to-cart and by hydration, so a union by id is
 * collision-safe.
 *
 * Exported for testing.
 */
export const mergeHydratedItems = (
    current: CartItemsByCafeId,
    hydrated: CartItemsByCafeId,
): CartItemsByCafeId => {
    const merged: CartItemsByCafeId = new Map();
    for (const [cafeId, cafeItems] of current) {
        merged.set(cafeId, new Map(cafeItems));
    }
    for (const [cafeId, hydratedItems] of hydrated) {
        // Defensive: skip empty buckets so a hydration response missing every
        // item for a cafe doesn't show up as a ghost cafe-header in the order
        // UI. OrderingClient.hydrateCart already filters these out, but a
        // future code path that calls setItems directly could reintroduce
        // them.
        if (hydratedItems.size === 0) {
            continue;
        }
        let bucket = merged.get(cafeId);
        if (!bucket) {
            bucket = new Map();
            merged.set(cafeId, bucket);
        }
        for (const [id, item] of hydratedItems) {
            bucket.set(id, item);
        }
    }
    return merged;
};

const hydrateCartIntoStore = async (): Promise<true> => {
    // Read the latest persisted cart at call time. A snapshot at module load
    // would mean a retry after the user removed missing items / added items
    // rehydrates the original (stale) boot data.
    const cartData = InternalSettings.cart.value;

    if (!hasBootData(cartData)) {
        useCartStore.getState().setItems(new Map());
        useCartStore.getState().setMissingItems(new Map());
        return true;
    }

    try {
        const data = await OrderingClient.hydrateCart(cartData);
        // Merge rather than replace so items added during pending hydration
        // are preserved.
        const current = useCartStore.getState().items;
        useCartStore.getState().setItems(mergeHydratedItems(current, data.foundItemsByCafeId));
        useCartStore.getState().setMissingItems(data.missingItemsByCafeId);
        return true;
    } catch (err) {
        // Preserve every booted item as "missing" so the user can retry or
        // remove them manually rather than losing their cart silently.
        useCartStore.getState().setMissingItems(
            new Map<string, Array<ISerializedCartItemWithName>>(Object.entries(cartData)),
        );
        throw err;
    }
};

/**
 * Owns the boot-time cart hydration network call. Side-effects the result into
 * the Zustand cart store; the query itself only tracks {pending, success, error}
 * so consumers can render loading / retry UI.
 *
 * Lazy and self-gating: only fires when online ordering is currently allowed
 * (no weekend, today selected, setting enabled). Probing the server outside
 * that window is guaranteed to fail because today's menu doesn't exist on
 * weekends, etc.
 *
 * Mount this from every surface that reads cart items. Multiple mounts share
 * the same query — TanStack dedupes by queryKey, so the request fires at
 * most once per page load when ordering is allowed.
 */
export const useCartHydrationQuery = () => {
    const isOnlineOrderingAllowed = useIsOnlineOrderingAllowed();
    return useQuery({
        queryKey:  queryKeys.cart.hydration,
        queryFn:   hydrateCartIntoStore,
        staleTime: Infinity,
        gcTime:    Infinity,
        retry:     false,
        enabled:   isOnlineOrderingAllowed,
    });
};

export interface ICartHydrationStatus {
    isPending: boolean;
    isError: boolean;
    retry: () => void;
}

/**
 * Consumer-facing slice of the hydration query: just {pending, error, retry}.
 * Read missing items separately via `useCartStore(s => s.missingItemsByCafeId)`.
 *
 * Reports isPending=false when ordering isn't allowed so consumers don't
 * render a perpetual loading spinner.
 */
export const useCartHydrationStatus = (): ICartHydrationStatus => {
    const isOnlineOrderingAllowed = useIsOnlineOrderingAllowed();
    const query = useCartHydrationQuery();
    return {
        isPending: isOnlineOrderingAllowed && query.isPending,
        isError:   query.isError,
        retry: () => {
            void query.refetch();
        },
    };
};
