import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CartClient } from '../../api/cart.ts';
import { useServerCartStore } from '../zustand/server-cart.ts';
import type { ICartItemData, ICartItemUpdate, ICartResponse } from '@msdining/common/models/cart';
import { useCallback } from 'react';
import { useDebouncedCallback } from '../../hooks/debounce.ts';

const CART_QUERY_KEY = ['cart', 'server'] as const;

/**
 * Sync the Zustand cache from a server response.
 * Called after every successful query/mutation.
 */
const syncStoreFromResponse = (response: ICartResponse) => {
    useServerCartStore.getState().setFromServerResponse(response);
};

const useSyncOnSuccess = () => {
    const queryClient = useQueryClient();
    return (response: ICartResponse) => {
        syncStoreFromResponse(response);
        queryClient.setQueryData(CART_QUERY_KEY, response);
    };
};

/**
 * Fetches the cart from the server. The response includes enriched menu item
 * data and availability — this replaces the old hydration flow entirely.
 */
export const useCartQuery = () => {
    return useQuery({
        queryKey: CART_QUERY_KEY,
        queryFn:  async () => {
            const response = await CartClient.getCart();
            syncStoreFromResponse(response);
            return response;
        },
    });
};

/**
 * Add an item to the cart. Returns the full cart.
 */
export const useAddToCartMutation = () => {
    const onSuccess = useSyncOnSuccess();

    return useMutation({
        mutationFn: (item: ICartItemData) => CartClient.addItem(item),
        onSuccess,
    });
};

/**
 * Update a cart item with debouncing. Handles optimistic quantity updates
 * internally — callers just call `mutate(itemId, update)`.
 *
 * The actual server request fires after 500ms of inactivity, coalescing
 * rapid +/- clicks into a single PATCH.
 */
export const useDebouncedUpdateCartItem = () => {
    const onSuccess = useSyncOnSuccess();

    const { call: debouncedSend, flush } = useDebouncedCallback(
        async (itemId: string, update: ICartItemUpdate) => {
            const response = await CartClient.updateItem(itemId, update);
            onSuccess(response);
        },
        500,
    );

    const mutate = useCallback((itemId: string, update: ICartItemUpdate) => {
        if (update.quantity !== undefined) {
            useServerCartStore.getState().optimisticUpdateQuantity(itemId, update.quantity);
        }
        debouncedSend(itemId, update);
    }, [debouncedSend]);

    return { mutate, flush };
};

/**
 * Remove an item from the cart. Optimistically hides the item in the
 * Zustand cache immediately, then confirms with the server.
 */
export const useRemoveCartItemMutation = () => {
    const onSuccess = useSyncOnSuccess();

    const mutation = useMutation({
        mutationFn: (itemId: string) => CartClient.removeItem(itemId),
        onSuccess,
    });

    const mutate = useCallback((itemId: string) => {
        useServerCartStore.getState().optimisticRemoveItem(itemId);
        mutation.mutate(itemId);
    }, [mutation]);

    return { ...mutation, mutate };
};

/**
 * Clear all items from the cart.
 */
export const useClearCartMutation = () => {
    const onSuccess = useSyncOnSuccess();

    return useMutation({
        mutationFn: () => CartClient.clearCart(),
        onSuccess,
    });
};
