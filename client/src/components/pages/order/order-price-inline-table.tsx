import React, { useMemo } from 'react';
import { useServerCartAvailableItems, useServerCartItemsByCafe } from '../../../store/zustand/server-cart.ts';
import { calculatePrice, formatPrice } from '../../../util/cart.ts';
import { useAggregatedCartEstimate } from '../../../store/queries/ordering.ts';

const OrderPriceInlineTableRow: React.FC<{ label: string; price?: number }> = ({ label, price }) => (
    <tr>
        <td colSpan={1}/>
        <td>{label}</td>
        <td className="price">{price ? formatPrice(price) : 'Unavailable'}</td>
        <td colSpan={1}/>
    </tr>
);

export const OrderPriceInlineTable: React.FC = () => {
    const availableItems = useServerCartAvailableItems();
    const cartItemsByCafe = useServerCartItemsByCafe();

    const cafeIds = useMemo(() => cartItemsByCafe.map(group => group.cafeId), [cartItemsByCafe]);
    const estimate = useAggregatedCartEstimate(cafeIds);

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
            />
            <OrderPriceInlineTableRow
                label="Total"
                price={hasServerPricing ? estimate!.total : localTotalWithoutTax}
            />
        </>
    );
};
