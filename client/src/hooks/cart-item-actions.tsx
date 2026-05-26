import type { ICartItemRecord, ICartItemUpdate } from '@msdining/common/models/cart';
import { useCallback } from 'react';
import { usePopupOpener } from './popup.ts';
import {
    useDebouncedUpdateCartItem,
    useRemoveCartItemMutation,
} from '../store/queries/server-cart.ts';
import { MenuItemPopup } from '../components/cafes/station/menu-items/popup/menu-item-popup.tsx';

const editCartItemSymbol = Symbol('edit-cart-item');

export interface ISnapshotCallbacks {
    removeItem: (itemId: string) => void;
    updateItem: (itemId: string, update: ICartItemUpdate) => void;
}

/**
 * Shared cart item action handlers — remove, edit (opens popup), change quantity.
 * All edits send a full replacement update for clean last-writer-wins semantics.
 *
 * When snapshotCallbacks are provided, the snapshot is updated alongside the server mutation.
 */
export const useCartItemActions = (snapshotCallbacks?: ISnapshotCallbacks) => {
    const removeItem = useRemoveCartItemMutation();
    const updateCartItem = useDebouncedUpdateCartItem();
    const openPopup = usePopupOpener();

    const buildFullUpdate = useCallback((item: ICartItemRecord, overrides: Partial<ICartItemUpdate>): ICartItemUpdate => ({
        quantity:            overrides.quantity ?? item.quantity,
        modifiers:           overrides.modifiers ?? item.modifiers,
        specialInstructions: overrides.specialInstructions ?? item.specialInstructions,
    }), []);

    const onRemove = useCallback((item: ICartItemRecord) => {
        removeItem.mutate(item.id);
        snapshotCallbacks?.removeItem(item.id);
    }, [removeItem, snapshotCallbacks]);

    const onEdit = useCallback((item: ICartItemRecord) => {
        openPopup({
            id:   editCartItemSymbol,
            body: <MenuItemPopup
                cafeId={item.menuItem.cafeId}
                menuItem={item.menuItem}
                modalSymbol={editCartItemSymbol}
                fromCartItem={item}
                onUpdated={(update) => {
                    const full = buildFullUpdate(item, update);
                    snapshotCallbacks?.updateItem(item.id, full);
                }}
            />,
        });
    }, [buildFullUpdate, openPopup, snapshotCallbacks]);

    const onChangeQuantity = useCallback((item: ICartItemRecord, quantity: number) => {
        if (quantity < 1) {
            return;
        }
        const full = buildFullUpdate(item, { quantity });
        updateCartItem.mutate(item.id, full);
        snapshotCallbacks?.updateItem(item.id, full);
    }, [buildFullUpdate, updateCartItem, snapshotCallbacks]);

    return { onRemove, onEdit, onChangeQuantity };
};
