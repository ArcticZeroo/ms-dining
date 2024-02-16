import { CartContext } from '../../context/cart.ts';
import { useValueNotifierContext } from '../../hooks/events.ts';
import { useCallback, useEffect, useMemo } from 'react';
import { OrderingClient } from '../../api/order.ts';
import { useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { calculatePrice, getPriceDisplay } from '../../util/cart.ts';
import { IPriceResponse } from '@msdining/common/dist/models/http';

export const OrderPriceInlineTable = () => {
    const cart = useValueNotifierContext(CartContext);

    const retrievePriceCallback = useCallback(
        () => OrderingClient.retrievePrice(cart),
        [cart]
    );

    const { value, error, run } = useDelayedPromiseState(retrievePriceCallback, false /*keepLastValue*/);

    useEffect(() => {
        run();
    }, [run]);

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

    const price: IPriceResponse = useMemo(
        () => {
            return value ?? {
                totalTax:             -1,
                totalPriceWithTax:    localTotalWithoutTax,
                totalPriceWithoutTax: localTotalWithoutTax
            }
        },
        [value, localTotalWithoutTax]
    );

    const taxDisplay = price.totalTax >= 0
        ? getPriceDisplay(price.totalTax)
        : error != null
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
                    {getPriceDisplay(price.totalPriceWithoutTax)}
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
                    {getPriceDisplay(price.totalPriceWithTax)}
                </td>
            </tr>
        </>
    );
};