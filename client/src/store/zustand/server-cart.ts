import type { ICafeCartGroup, ICartItemRecord, ICartItemUpdate, ICartResponse } from '@msdining/common/models/cart';
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

interface IDisplayCafeCartGroup extends Omit<ICafeCartGroup, 'items'> {
    items: IDisplayCartItem[];
}

interface IServerCartStore {
    cafes: IDisplayCafeCartGroup[];

    setFromServerResponse(response: ICartResponse): void;
    optimisticAddItem(item: IDisplayCartItem): void;
    optimisticUpdateItem(itemId: string, update: ICartItemUpdate): void;
}

export const useServerCartStore = create<IServerCartStore>()(mutative((set) => ({
    cafes: [],

    setFromServerResponse: (response) => set((state) => {
        // Server response replaces all items — pending items are dropped
        state.cafes = response.cafes;
    }),

    optimisticAddItem: (item) => set((state) => {
        const cafeId = item.menuItem.cafeId;
        const cafe = state.cafes.find(group => group.cafeId === cafeId);

        if (cafe) {
            cafe.items.push(item);
            return;
        }

        state.cafes.push({
            cafeId,
            items: [item],
            availability: { status: 'unknown' },
        });
    }),

    optimisticUpdateItem: (itemId, update) => set((state) => {
        for (const cafe of state.cafes) {
            const item = cafe.items.find(entry => entry.id === itemId);
            if (!item) {
                continue;
            }

            item.quantity = update.quantity;
            item.specialInstructions = update.specialInstructions;
            item.modifiers = update.modifiers;
            break;
        }
    }),
})));

// ─── Derived selectors ───────────────────────────────────────────────

export const useServerCartItems = () => {
    const cafes = useServerCartStore(state => state.cafes);
    return useMemo(() => cafes.flatMap(cafe => cafe.items), [cafes]);
};

export const useServerCartItemCount = () => useServerCartStore(state =>
    state.cafes.reduce((sum, cafe) => sum + cafe.items.reduce((cafeSum, item) => cafeSum + item.quantity, 0), 0),
);

export const useServerCartHasAvailableItems = () => useServerCartStore(state =>
    state.cafes.some(cafe => cafe.items.some(item => item.isAvailable)),
);

export const useServerCartHasUnavailableItems = () => useServerCartStore(state =>
    state.cafes.some(cafe => cafe.items.some(item => !item.isAvailable)),
);

export const useServerCartAvailableItems = () => {
    const items = useServerCartItems();
    return useMemo(() => items.filter(item => item.isAvailable), [items]);
};

export const useServerCartUnavailableItems = () => {
    const items = useServerCartItems();
    return useMemo(() => items.filter(item => !item.isAvailable), [items]);
};

export const useServerCartItemsByCafe = () => useServerCartStore(state => state.cafes);
