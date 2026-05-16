import { useQuery } from '@tanstack/react-query';
import { OrderingClient } from '../../api/order.ts';
import { InternalSettings } from '../../constants/settings.ts';
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

const hydrateCartIntoStore = async (): Promise<void> => {
    // Read the latest persisted cart at call time. A snapshot at module load
    // would mean a retry after the user removed missing items / added items
    // rehydrates the original (stale) boot data.
    const cartData = InternalSettings.cart.value;

    if (!hasBootData(cartData)) {
        useCartStore.getState().setItems(new Map());
        useCartStore.getState().setMissingItems(new Map());
        return;
    }

    try {
        const data = await OrderingClient.hydrateCart(cartData);
        // Merge rather than replace so items added during pending hydration
        // are preserved.
        const current = useCartStore.getState().items;
        useCartStore.getState().setItems(mergeHydratedItems(current, data.foundItemsByCafeId));
        useCartStore.getState().setMissingItems(data.missingItemsByCafeId);
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
 * Mount this once near the root so hydration kicks off even when no cart UI is
 * visible (otherwise navigating to a cart-free page would skip hydration and
 * any later add-to-cart would clobber the saved cart).
 */
export const useCartHydrationQuery = () => {
    return useQuery({
        queryKey:  queryKeys.cart.hydration,
        queryFn:   hydrateCartIntoStore,
        staleTime: Infinity,
        gcTime:    Infinity,
        retry:     false,
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
 */
export const useCartHydrationStatus = (): ICartHydrationStatus => {
    const query = useCartHydrationQuery();
    return {
        isPending: query.isPending,
        isError:   query.isError,
        retry: () => {
            void query.refetch();
        },
    };
};
