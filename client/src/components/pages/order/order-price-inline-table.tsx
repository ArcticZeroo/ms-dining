import React, { useMemo } from 'react';
import { useServerCartAvailableItems, useServerCartItemsByCafe } from '../../../store/zustand/server-cart.ts';
import { calculatePrice, formatPrice } from '../../../util/cart.ts';
import { useAggregatedCartEstimate } from '../../../store/queries/ordering.ts';

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
            <tr>
                <td colSpan={2}></td>
                <td>
                    Subtotal
                </td>
                <td className="price">
                    {formatPrice(hasServerPricing ? estimate.subtotal : localTotalWithoutTax)}
                </td>
            </tr>
            <tr>
                <td colSpan={2}></td>
                <td>
                    Tax
                </td>
                <td className="price">
                    {hasServerPricing ? formatPrice(estimate.tax) : '—'}
                </td>
            </tr>
            <tr>
                <td colSpan={2}></td>
                <td>
                    Total{!hasServerPricing && ' (est.)'}
                </td>
                <td className="price">
                    {formatPrice(hasServerPricing ? estimate.total : localTotalWithoutTax)}
                </td>
            </tr>
        </>
    );
};
