import { CartContext } from '../../context/cart.ts';
import { useValueNotifierContext } from '../../hooks/events.ts';
import { useMemo } from 'react';
import { IPrepareCartResponse } from '@msdining/common/models/cart';
import { calculatePrice, formatPrice } from '../../util/cart.ts';

interface IOrderPriceInlineTableProps {
    cartSessionData: IPrepareCartResponse | null;
    cartSessionError: unknown;
}

export const OrderPriceInlineTable: React.FC<IOrderPriceInlineTableProps> = ({ cartSessionData, cartSessionError }) => {
    const cart = useValueNotifierContext(CartContext);

    const localTotalWithoutTax = useMemo(
        () => {
            let total = 0;

            for (const items of cart.values()) {
                for (const item of items.values()) {
                    const basePrice = calculatePrice(item.associatedItem, item.choicesByModifierId);
                    total += basePrice * item.quantity;
                }
            }

            return total;
        },
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