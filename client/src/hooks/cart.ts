import type { IDisplayableOrderItem } from '../components/pages/order/cart/cart-item-detail-cells.ts';
import { useMemo } from 'react';
import { calculatePrice } from '../util/cart.js';

export const useCartItemPrice = (item: IDisplayableOrderItem) => {
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