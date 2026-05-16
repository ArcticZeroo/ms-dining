import { useQuery } from '@tanstack/react-query';
import { OrderingClient } from '../../api/order.ts';
import { InternalSettings } from '../../constants/settings.ts';
import { ISerializedCartItemWithName } from '../../models/cart.ts';
import { useCartStore } from '../zustand/cart.ts';
import { queryKeys } from './keys.ts';

// Snapshot the localStorage cart at module load so all subsequent saves go
// through the live store rather than re-reading the original boot value.
const BOOT_CART_DATA = InternalSettings.cart.value;

const hasBootData = (): boolean =>
    BOOT_CART_DATA != null && Object.keys(BOOT_CART_DATA).length > 0;

const hydrateCartIntoStore = async () => {
    if (!hasBootData()) {
        useCartStore.getState().setItems(new Map());
        useCartStore.getState().setMissingItems(new Map());
        return;
    }

    try {
        const data = await OrderingClient.hydrateCart(BOOT_CART_DATA!);
        useCartStore.getState().setItems(data.foundItemsByCafeId);
        useCartStore.getState().setMissingItems(data.missingItemsByCafeId);
    } catch (err) {
        // Preserve every booted item as "missing" so the user can retry or
        // remove them manually rather than losing their cart silently.
        useCartStore.getState().setMissingItems(
            new Map<string, Array<ISerializedCartItemWithName>>(Object.entries(BOOT_CART_DATA!))
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
