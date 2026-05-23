import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ICafeOrderItem } from '@msdining/common/models/order';
import type { ICartItemData } from '@msdining/common/models/cart';
import { useAddItemsToCartMutation } from '../store/queries/server-cart.ts';

const toCartItemData = (item: ICafeOrderItem): ICartItemData => ({
    menuItemId:          item.menuItemId,
    quantity:            item.quantity,
    specialInstructions: item.specialInstructions ?? undefined,
    modifiers:           item.modifiers,
});

export const useReorder = () => {
    const addItems = useAddItemsToCartMutation();
    const navigate = useNavigate();

    const reorder = useCallback(async (items: ICafeOrderItem[]) => {
        await addItems.mutateAsync(items.map(toCartItemData));
        navigate('/order');
    }, [addItems, navigate]);

    return {
        reorder,
        isPending: addItems.isPending,
    };
};
