import type { ICartItemRecord, ICartItemUpdate, ICartResponse } from '@msdining/common/models/cart';
import { create } from 'zustand';
import { mutative } from 'zustand-mutative';
import { useMemo } from 'react';

/**
 * Thin Zustand cache over the server-side cart.
 *
 * TanStack Query is the source of truth (via useCartQuery). This store
 * provides immediate reads for components and optimistic updates for
 * add and quantity changes. Every successful server response reconciles
 * this store via setFromServerResponse().
 */

export interface IDisplayCartItem extends ICartItemRecord {
    isPending?: boolean;
}

interface IServerCartStore {
    items: IDisplayCartItem[];

    setFromServerResponse(response: ICartResponse): void;
    optimisticAddItem(item: IDisplayCartItem): void;
    optimisticUpdateItem(itemId: string, update: ICartItemUpdate): void;
}

export const useServerCartStore = create<IServerCartStore>()(mutative((set) => ({
    items: [],

    setFromServerResponse: (response) => set((state) => {
        // Server response replaces all items — pending items are dropped
        state.items = response.items;
    }),

    optimisticAddItem: (item) => set((state) => {
        state.items.push(item);
    }),

    optimisticUpdateItem: (itemId, update) => set((state) => {
        const item = state.items.find(i => i.id === itemId);
        if (item) {
            item.quantity = update.quantity;
            item.specialInstructions = update.specialInstructions;
            item.modifiers = update.modifiers;
        }
    }),
})));

// ─── Derived selectors ───────────────────────────────────────────────

export const useServerCartItems = () => useServerCartStore(state => state.items);

export const useServerCartItemCount = () => useServerCartStore(state =>
    state.items.reduce((sum, item) => sum + item.quantity, 0),
);

export const useServerCartHasUnavailableItems = () => useServerCartStore(state =>
    state.items.some(item => !item.isAvailable),
);

export const useServerCartAvailableItems = () => {
    const items = useServerCartStore(state => state.items);
    return useMemo(() => items.filter(item => item.isAvailable), [items]);
};

export const useServerCartUnavailableItems = () => {
    const items = useServerCartStore(state => state.items);
    return useMemo(() => items.filter(item => !item.isAvailable), [items]);
};

/** Group cart items by cafeId for display. */
export const useServerCartItemsByCafe = () => {
    const items = useServerCartStore(state => state.items);
    return useMemo(() => {
        const byCafe = new Map<string, ICartItemRecord[]>();
        for (const item of items) {
            const cafeId = item.menuItem.cafeId;
            const existing = byCafe.get(cafeId);
            if (existing) {
                existing.push(item);
            } else {
                byCafe.set(cafeId, [item]);
            }
        }
        return byCafe;
    }, [items]);
};
