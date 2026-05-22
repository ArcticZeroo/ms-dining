import React, { useMemo } from 'react';
import { useServerCartActiveOrder } from '../../store/zustand/server-cart.ts';
import { useServerCartAvailableItems } from '../../store/zustand/server-cart.ts';
import { calculatePrice, formatPrice } from '../../util/cart.ts';

export const OrderPriceInlineTable: React.FC = () => {
    const availableItems = useServerCartAvailableItems();
    const activeOrder = useServerCartActiveOrder();

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

    // After checkout, the server has real totals per cafe part
    const serverTotal = useMemo(() => {
        if (!activeOrder) {
            return null;
        }

        let total = 0;
        for (const part of activeOrder.cafeParts) {
            if (part.total != null) {
                total += part.total;
            }
        }

        return total > 0 ? total : null;
    }, [activeOrder]);

    const displayTotal = serverTotal ?? localTotalWithoutTax;

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
                    {formatPrice(displayTotal)}
                </td>
            </tr>
        </>
    );
};
