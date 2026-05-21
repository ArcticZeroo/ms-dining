import React, { useMemo } from 'react';
import { useCartSessionQuery } from '../../store/queries/ordering.ts';
import { useServerCartItems } from '../../store/zustand/server-cart.ts';
import { calculatePrice, formatPrice } from '../../util/cart.ts';

export const OrderPriceInlineTable: React.FC = () => {
    const cart = useServerCartItems();
    const { data: cartSessionData, error: cartSessionError } = useCartSessionQuery();

    const localTotalWithoutTax = useMemo(
        () => cart.reduce((total, item) => {
            const basePrice = calculatePrice(
                item.menuItem,
                new Map(item.modifiers.map(modifier => [modifier.modifierId, new Set(modifier.choiceIds)])),
            );
            return total + (basePrice * item.quantity);
        }, 0),
        [cart]
    );

    const serverPrice = useMemo(() => {
        if (!cartSessionData) {
            return null;
        }

        let totalPriceWithTax = 0;
        let totalPriceWithoutTax = 0;
        let totalTax = 0;

        for (const cafeData of Object.values(cartSessionData)) {
            totalPriceWithTax += cafeData.totalPriceWithTax;
            totalPriceWithoutTax += cafeData.totalPriceWithoutTax;
            totalTax += cafeData.totalTax;
        }

        return { totalPriceWithTax, totalPriceWithoutTax, totalTax };
    }, [cartSessionData]);

    const subtotal = serverPrice?.totalPriceWithoutTax ?? localTotalWithoutTax;
    const total = serverPrice?.totalPriceWithTax ?? localTotalWithoutTax;

    const taxDisplay = serverPrice
        ? formatPrice(serverPrice.totalTax)
        : cartSessionError != null
            ? 'Failed to load'
            : 'Loading...';

    return (
        <>
            <tr>
                <td colSpan={2}></td>
                <td>
                    Subtotal
                </td>
                <td className="price">
                    {formatPrice(subtotal)}
                </td>
            </tr>
            <tr>
                <td colSpan={2}></td>
                <td>
                    Tax
                </td>
                <td className="price">
                    {taxDisplay}
                </td>
            </tr>
            <tr>
                <td colSpan={2}></td>
                <td>
                    Total
                </td>
                <td className="price">
                    {formatPrice(total)}
                </td>
            </tr>
        </>
    );
};
