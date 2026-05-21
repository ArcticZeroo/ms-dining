import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CartClient } from '../../api/cart.ts';
import { useServerCartStore } from '../zustand/server-cart.ts';
import type { ICartItemData, ICartItemUpdate, ICartResponse } from '@msdining/common/models/cart';
import { useCallback, useRef } from 'react';

const CART_QUERY_KEY = ['cart', 'server'] as const;

/**
 * Sync the Zustand cache from a server response.
 * Called after every successful query/mutation.
 */
const syncStoreFromResponse = (response: ICartResponse) => {
    useServerCartStore.getState().setFromServerResponse(response);
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
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (item: ICartItemData) => CartClient.addItem(item),
        onSuccess:  (response) => {
            syncStoreFromResponse(response);
            queryClient.setQueryData(CART_QUERY_KEY, response);
        },
    });
};

/**
 * Update a cart item. Supports debouncing for quantity spam.
 *
 * Usage:
 *   const { mutate, flush } = useDebouncedUpdateCartItem();
 *   // On each +/- click:
 *   mutate(itemId, { quantity: newQuantity });
 *   // The actual request fires after 500ms of inactivity.
 */
export const useDebouncedUpdateCartItem = () => {
    const queryClient = useQueryClient();
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingRef = useRef<{ itemId: string; update: ICartItemUpdate } | null>(null);

    const flush = useCallback(async () => {
        if (timerRef.current != null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        const pending = pendingRef.current;
        if (!pending) {
            return;
        }
        pendingRef.current = null;

        const response = await CartClient.updateItem(pending.itemId, pending.update);
        syncStoreFromResponse(response);
        queryClient.setQueryData(CART_QUERY_KEY, response);
    }, [queryClient]);

    const mutate = useCallback((itemId: string, update: ICartItemUpdate) => {
        // Optimistic update in Zustand
        if (update.quantity !== undefined) {
            useServerCartStore.getState().optimisticUpdateQuantity(itemId, update.quantity);
        }

        pendingRef.current = { itemId, update };

        if (timerRef.current != null) {
            clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(flush, 500);
    }, [flush]);

    return { mutate, flush };
};

/**
 * Remove an item from the cart.
 */
export const useRemoveCartItemMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (itemId: string) => CartClient.removeItem(itemId),
        onSuccess:  (response) => {
            syncStoreFromResponse(response);
            queryClient.setQueryData(CART_QUERY_KEY, response);
        },
    });
};

/**
 * Clear all items from the cart.
 */
export const useClearCartMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => CartClient.clearCart(),
        onSuccess:  (response) => {
            syncStoreFromResponse(response);
            queryClient.setQueryData(CART_QUERY_KEY, response);
        },
    });
};
