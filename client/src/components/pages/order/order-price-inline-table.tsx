import React, { useMemo } from 'react';
import { useServerCartAvailableItems, useServerCartItemsByCafe } from '../../../store/zustand/server-cart.ts';
import { calculatePrice } from '../../../util/cart.ts';
import { useAggregatedCartEstimate } from '../../../store/queries/ordering.ts';
import { OrderPriceInlineTableRow } from './order-price-inline-table-row.tsx';

export const OrderPriceInlineTable: React.FC = () => {
    const availableItems = useServerCartAvailableItems();
    const cartItemsByCafe = useServerCartItemsByCafe();

    const cafeIds = useMemo(() => cartItemsByCafe.map(group => group.cafeId), [cartItemsByCafe]);
    const { data: estimate, isLoading } = useAggregatedCartEstimate(cafeIds);

    const localTotalWithoutTax = useMemo(
        () => availableItems.reduce((total, item) => {
            const basePrice = calculatePrice(
                item.menuItem,
                new Map(item.modifiers.map(modifier => [modifier.modifierId, new Set(modifier.choiceIds)])),
            );
            return total + (basePrice * item.quantity);
        }, 0),
        [availableItems]
    );

    const hasServerPricing = estimate != null && estimate.total > 0;

    return (
        <>
            <OrderPriceInlineTableRow
                label="Subtotal"
                price={hasServerPricing ? estimate!.subtotal : localTotalWithoutTax}
            />
            <OrderPriceInlineTableRow
                label="Tax"
                price={estimate?.tax}
                isLoading={isLoading}
            />
            <OrderPriceInlineTableRow
                label="Total"
                price={hasServerPricing ? estimate!.total : localTotalWithoutTax}
            />
        </>
    );
};
