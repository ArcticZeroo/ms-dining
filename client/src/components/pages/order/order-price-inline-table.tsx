import React, { useMemo } from 'react';
import { useServerCartAvailableItems } from '../../../store/zustand/server-cart.ts';
import { calculatePrice, formatPrice } from '../../../util/cart.ts';

export const OrderPriceInlineTable: React.FC = () => {
    const availableItems = useServerCartAvailableItems();

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

    return (
        <>
            <tr>
                <td colSpan={2}></td>
                <td>
                    Subtotal
                </td>
                <td className="price">
                    {formatPrice(localTotalWithoutTax)}
                </td>
            </tr>
            <tr>
                <td colSpan={2}></td>
                <td>
                    Tax
                </td>
                <td className="price">
                    Calculated at checkout
                </td>
            </tr>
            <tr>
                <td colSpan={2}></td>
                <td>
                    Total (est.)
                </td>
                <td className="price">
                    {formatPrice(localTotalWithoutTax)}
                </td>
            </tr>
        </>
    );
};
