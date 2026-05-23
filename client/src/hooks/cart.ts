import type { ICartItemRecord } from '@msdining/common/models/cart';
import { useMemo } from 'react';
import { calculatePrice } from '../util/cart.js';

export const useCartItemPrice = (item: ICartItemRecord) => {
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