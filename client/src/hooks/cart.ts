import type { IDisplayableItem } from '../components/pages/order/cart/cart-item-detail-cells.ts';
import { useMemo } from 'react';
import { calculatePrice } from '../util/cart.js';

export const useCartItemPrice = (item: IDisplayableItem) => {
    const modifiersById = useMemo(
        () => new Map(item.modifiers.map(modifier => [modifier.modifierId, new Set(modifier.choiceIds)])),
        [item.modifiers]
    );

    return calculatePrice(
        item.menuItem,
        modifiersById,
        item.quantity
    );
}