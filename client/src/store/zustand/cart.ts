import { create } from 'zustand';
import { mutative } from 'zustand-mutative';
import { InternalSettings } from '../../constants/settings.ts';
import {
    CartItemsByCafeId,
    ICartItemWithMetadata,
    ISerializedCartItemsByCafeId,
    ISerializedCartItemWithName
} from '../../models/cart.ts';
import { queryKeys } from '../queries/keys.ts';
import { QUERY_CLIENT } from '../query-client.ts';

type MissingItemsByCafeId = Map<string, Array<ISerializedCartItemWithName>>;

interface ICartStore {
    items: CartItemsByCafeId;
    missingItemsByCafeId: MissingItemsByCafeId;

    setItems(items: CartItemsByCafeId): void;
    addOrEditItem(item: ICartItemWithMetadata): void;
    removeItem(item: ICartItemWithMetadata): void;
    removeCafe(cafeId: string): void;

    setMissingItems(missingItems: MissingItemsByCafeId): void;
    removeMissingItemAt(cafeId: string, index: number): void;
    clearMissingItems(): void;
}

export const useCartStore = create<ICartStore>()(mutative((set) => ({
    items:                new Map(),
    missingItemsByCafeId: new Map(),

    setItems: (items) => set((state) => {
        state.items = items;
    }),

    addOrEditItem: (item) => set((state) => {
        let cafeItems = state.items.get(item.cafeId);
        if (!cafeItems) {
            cafeItems = new Map();
            state.items.set(item.cafeId, cafeItems);
        }
        cafeItems.set(item.id, item);
    }),

    removeItem: (item) => set((state) => {
        const cafeItems = state.items.get(item.cafeId);
        if (!cafeItems) {
            return;
        }
        cafeItems.delete(item.id);
        if (cafeItems.size === 0) {
            state.items.delete(item.cafeId);
        }
    }),

    removeCafe: (cafeId) => set((state) => {
        state.items.delete(cafeId);
    }),

    setMissingItems: (missingItems) => set((state) => {
        state.missingItemsByCafeId = missingItems;
    }),

    removeMissingItemAt: (cafeId, index) => set((state) => {
        const list = state.missingItemsByCafeId.get(cafeId);
        if (!list || index < 0 || index >= list.length) {
            return;
        }
        list.splice(index, 1);
        if (list.length === 0) {
            state.missingItemsByCafeId.delete(cafeId);
        }
    }),

    clearMissingItems: () => set((state) => {
        if (state.missingItemsByCafeId.size > 0) {
            state.missingItemsByCafeId = new Map();
        }
    }),
})));

export const serializeCartForPersistence = (
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

// Persist cart + missing items whenever they change, BUT skip writes while a
// hydration query is actively in-flight. Persisting mid-hydration could
// clobber the boot data before we've finished reading it back. If hydration
// never ran (status === undefined, e.g. user never opened a cart surface)
// writes are still safe because nothing has been pulled into memory yet —
// the localStorage entry stays as-is until something does pull it.
useCartStore.subscribe((state, prev) => {
    if (state.items === prev.items && state.missingItemsByCafeId === prev.missingItemsByCafeId) {
        return;
    }

    const hydrationStatus = QUERY_CLIENT.getQueryState(queryKeys.cart.hydration)?.status;
    if (hydrationStatus === 'pending') {
        return;
    }

    InternalSettings.cart.value = serializeCartForPersistence(state.items, state.missingItemsByCafeId);
});
