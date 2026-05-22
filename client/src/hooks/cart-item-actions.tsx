import type { ICartItemRecord } from '@msdining/common/models/cart';
import { useCallback } from 'react';
import { usePopupOpener } from './popup.ts';
import {
    useDebouncedUpdateCartItem,
    useRemoveCartItemMutation,
} from '../store/queries/server-cart.ts';
import { MenuItemPopup } from '../components/cafes/station/menu-items/popup/menu-item-popup.tsx';

const editCartItemSymbol = Symbol('edit-cart-item');

/**
 * Shared cart item action handlers — remove, edit (opens popup), change quantity.
 * Optionally calls an `onSnapshotChanged` callback for local snapshot updates.
 */
export const useCartItemActions = (onSnapshotChanged?: {
    onItemRemoved: (itemId: string) => void;
    onItemQuantityChanged: (itemId: string, quantity: number) => void;
}) => {
    const removeItem = useRemoveCartItemMutation();
    const updateCartItem = useDebouncedUpdateCartItem();
    const openPopup = usePopupOpener();

    const onRemove = useCallback((item: ICartItemRecord) => {
        removeItem.mutate(item.id);
        onSnapshotChanged?.onItemRemoved(item.id);
    }, [removeItem, onSnapshotChanged]);

    const onEdit = useCallback((item: ICartItemRecord) => {
        openPopup({
            id:   editCartItemSymbol,
            body: <MenuItemPopup
                cafeId={item.menuItem.cafeId}
                menuItem={item.menuItem}
                modalSymbol={editCartItemSymbol}
                fromCartItem={item}
            />,
        });
    }, [openPopup]);

    const onChangeQuantity = useCallback((item: ICartItemRecord, quantity: number) => {
        if (quantity < 1) {
            return;
        }
        updateCartItem.mutate(item.id, { quantity });
        onSnapshotChanged?.onItemQuantityChanged(item.id, quantity);
    }, [updateCartItem, onSnapshotChanged]);

    return { onRemove, onEdit, onChangeQuantity };
};
