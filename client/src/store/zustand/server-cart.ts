import { create } from 'zustand';
import { mutative } from 'zustand-mutative';
import type {
    ICartItemRecord,
    IActiveOrderSummary,
    ICartResponse,
} from '@msdining/common/models/cart';

/**
 * Thin Zustand cache over the server-side cart.
 *
 * TanStack Query is the source of truth (via useCartQuery). This store
 * provides immediate reads for components and optimistic updates for
 * quantity debouncing. Every successful server response reconciles
 * this store via setFromServerResponse().
 */

interface IServerCartStore {
    items: ICartItemRecord[];
    activeOrder: IActiveOrderSummary | undefined;

    /** Reconcile from a server response. Called after every query/mutation success. */
    setFromServerResponse(response: ICartResponse): void;

    /** Optimistic quantity update for debounced +/- buttons. */
    optimisticUpdateQuantity(itemId: string, quantity: number): void;

    /** Optimistic remove for immediate UI feedback. */
    optimisticRemoveItem(itemId: string): void;
}

export const useServerCartStore = create<IServerCartStore>()(mutative((set) => ({
    items:       [],
    activeOrder: undefined,

    setFromServerResponse: (response) => set((state) => {
        state.items = response.items;
        state.activeOrder = response.activeOrder;
    }),

    optimisticUpdateQuantity: (itemId, quantity) => set((state) => {
        const item = state.items.find(i => i.id === itemId);
        if (item) {
            item.quantity = quantity;
        }
    }),

    optimisticRemoveItem: (itemId) => set((state) => {
        state.items = state.items.filter(i => i.id !== itemId);
    }),
})));

// ─── Derived selectors ───────────────────────────────────────────────

export const useServerCartItems = () => useServerCartStore(state => state.items);
export const useServerCartActiveOrder = () => useServerCartStore(state => state.activeOrder);

export const useServerCartItemCount = () => useServerCartStore(state =>
    state.items.reduce((sum, item) => sum + item.quantity, 0),
);

export const useServerCartHasUnavailableItems = () => useServerCartStore(state =>
    state.items.some(item => !item.isAvailable),
);

export const useServerCartAvailableItems = () => useServerCartStore(state =>
    state.items.filter(item => item.isAvailable),
);

export const useServerCartUnavailableItems = () => useServerCartStore(state =>
    state.items.filter(item => !item.isAvailable),
);

/** Group cart items by cafeId for display. */
export const useServerCartItemsByCafe = () => useServerCartStore(state => {
    const byCafe = new Map<string, ICartItemRecord[]>();
    for (const item of state.items) {
        const cafeId = item.menuItem.cafeId;
        const existing = byCafe.get(cafeId);
        if (existing) {
            existing.push(item);
        } else {
            byCafe.set(cafeId, [item]);
        }
    }
    return byCafe;
});
