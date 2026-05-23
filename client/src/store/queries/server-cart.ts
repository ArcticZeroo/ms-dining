import { useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query';
import { CartClient } from '../../api/cart.ts';
import { useServerCartStore } from '../zustand/server-cart.ts';
import type { ICartItemData, ICartItemUpdate, ICartResponse } from '@msdining/common/models/cart';
import type { IMenuItemBase } from '@msdining/common/models/cafe';
import { useCallback } from 'react';
import { useDebouncedCallback } from '../../hooks/debounce.ts';

export const CART_QUERY_KEY = ['cart', 'server'] as const;

const CART_REMOVE_MUTATION_KEY = ['cart', 'remove-item'] as const;

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
 * Add an item to the cart. Optimistically inserts a pending item into the
 * Zustand store so the cart UI updates immediately.
 */
export const useAddToCartMutation = () => {
    const onSuccess = useSyncOnSuccess();

    return useMutation({
        mutationFn: ({ item }: { item: ICartItemData; menuItem: IMenuItemBase }) =>
            CartClient.addItem(item),
        onMutate: ({ item, menuItem }) => {
            const now = new Date().toISOString();
            useServerCartStore.getState().optimisticAddItem({
                id:                  `pending-${Date.now()}`,
                menuItemId:          item.menuItemId,
                quantity:            item.quantity,
                specialInstructions: item.specialInstructions ?? null,
                modifiers:           item.modifiers,
                createdAt:           now,
                updatedAt:           now,
                menuItem,
                isAvailable:         true,
                isPending:           true,
            });
        },
        onSuccess,
    });
};

/**
 * Update a cart item with debouncing. Optimistically updates the Zustand
 * store immediately so rapid +/- clicks feel responsive. The actual server
 * request fires after 500ms of inactivity, coalescing into a single PATCH.
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
        useServerCartStore.getState().optimisticUpdateItem(itemId, update);
        debouncedSend(itemId, update);
    }, [debouncedSend]);

    return { mutate, flush };
};

/**
 * Remove an item from the cart. No optimistic removal — the row stays
 * visible in a read-only state until the server confirms deletion.
 */
export const useRemoveCartItemMutation = () => {
    const onSuccess = useSyncOnSuccess();

    return useMutation({
        mutationKey: CART_REMOVE_MUTATION_KEY,
        mutationFn:  (itemId: string) => CartClient.removeItem(itemId),
        onSuccess,
    });
};

/**
 * Returns true if the given cart item has an in-flight remove mutation.
 * CartItemRow uses this to show a read-only state while deletion is pending.
 */
export const useIsCartItemBeingRemoved = (itemId: string): boolean => {
    const pendingRemoves = useMutationState({
        filters: { mutationKey: CART_REMOVE_MUTATION_KEY, status: 'pending' },
        select:  (mutation) => mutation.state.variables as string | undefined,
    });
    return pendingRemoves.includes(itemId);
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
