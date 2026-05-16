import { create } from 'zustand';
import { InternalSettings } from '../../constants/settings.ts';
import { CartItemsByCafeId, ICartItemWithMetadata, ISerializedCartItemsByCafeId, ISerializedCartItemWithName } from '../../models/cart.ts';
import { addOrEditCartItem, removeFromCart, shallowCloneCart } from '../../util/cart.ts';
import { queryKeys } from '../queries/keys.ts';
import { queryClient } from '../query-client.ts';

type MissingItemsByCafeId = Map<string, Array<ISerializedCartItemWithName>>;

interface ICartStore {
    items: CartItemsByCafeId;
    missingItemsByCafeId: MissingItemsByCafeId;

    setItems(items: CartItemsByCafeId): void;
    updateItems(updater: (current: CartItemsByCafeId) => CartItemsByCafeId): void;
    addOrEditItem(item: ICartItemWithMetadata): void;
    removeItem(item: ICartItemWithMetadata): void;
    removeCafe(cafeId: string): void;

    setMissingItems(missingItems: MissingItemsByCafeId): void;
    removeMissingItem(cafeId: string, item: ISerializedCartItemWithName): void;
    clearMissingItems(): void;
}

export const useCartStore = create<ICartStore>()((set) => ({
    items:                new Map(),
    missingItemsByCafeId: new Map(),

    setItems: (items) => set({ items }),
    updateItems: (updater) => set((state) => ({ items: updater(state.items) })),
    addOrEditItem: (item) => set((state) => {
        const next = shallowCloneCart(state.items);
        addOrEditCartItem(next, item);
        return { items: next };
    }),
    removeItem: (item) => set((state) => {
        const next = shallowCloneCart(state.items);
        removeFromCart(next, item);
        return { items: next };
    }),
    removeCafe: (cafeId) => set((state) => {
        if (!state.items.has(cafeId)) {
            return state;
        }
        const next = shallowCloneCart(state.items);
        next.delete(cafeId);
        return { items: next };
    }),

    setMissingItems: (missingItems) => set({ missingItemsByCafeId: missingItems }),
    removeMissingItem: (cafeId, item) => set((state) => {
        const currentForCafe = state.missingItemsByCafeId.get(cafeId);
        if (!currentForCafe) {
            return state;
        }
        const remaining = currentForCafe.filter((other) => other !== item);
        const next = new Map(state.missingItemsByCafeId);
        if (remaining.length === 0) {
            next.delete(cafeId);
        } else {
            next.set(cafeId, remaining);
        }
        return { missingItemsByCafeId: next };
    }),
    clearMissingItems: () => set((state) => {
        if (state.missingItemsByCafeId.size === 0) {
            return state;
        }
        return { missingItemsByCafeId: new Map() };
    }),
}));

const serializeCartForPersistence = (
    items: CartItemsByCafeId,
    missingItemsByCafeId: MissingItemsByCafeId
): ISerializedCartItemsByCafeId => {
    const serializedValue: ISerializedCartItemsByCafeId = {};

    for (const [cafeId, itemsById] of items.entries()) {
        const serializedItems: ISerializedCartItemWithName[] = [];

        for (const item of itemsById.values()) {
            serializedItems.push({
                itemId:              item.itemId,
                name:                item.associatedItem.name,
                quantity:            item.quantity,
                modifiers:           Array.from(item.choicesByModifierId.entries()).map(([modifierId, choiceIds]) => ({
                    modifierId,
                    choiceIds: Array.from(choiceIds)
                })),
                specialInstructions: item.specialInstructions
            });
        }

        const missingItemsForCafe = missingItemsByCafeId.get(cafeId) ?? [];
        serializedItems.push(...missingItemsForCafe);

        serializedValue[cafeId] = serializedItems;
    }

    // Also persist cafes that exist only as missing items (e.g. hydration failed
    // and nothing has been added to the live cart yet). Without this, the next
    // save would wipe the un-hydrated items from localStorage.
    for (const [cafeId, missingItems] of missingItemsByCafeId.entries()) {
        if (missingItems.length === 0 || serializedValue[cafeId] != null) {
            continue;
        }

        serializedValue[cafeId] = [...missingItems];
    }

    return serializedValue;
};

// Persist cart + missing items whenever they change, but only after the
// hydration query has settled. Persisting before that would overwrite the
// boot data before we have a chance to read it back from the server.
useCartStore.subscribe((state, prev) => {
    if (state.items === prev.items && state.missingItemsByCafeId === prev.missingItemsByCafeId) {
        return;
    }

    const hydrationStatus = queryClient.getQueryState(queryKeys.cart.hydration)?.status;
    if (hydrationStatus !== 'success') {
        return;
    }

    InternalSettings.cart.value = serializeCartForPersistence(state.items, state.missingItemsByCafeId);
});
