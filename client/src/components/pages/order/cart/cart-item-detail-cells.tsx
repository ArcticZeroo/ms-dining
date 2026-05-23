import type { ICartItemRecord } from '@msdining/common/models/cart';
import React from 'react';
import { formatPrice } from '../../../../util/cart.ts';
import { useCartItemPrice } from '../../../../hooks/cart.ts';
import { CartItemModifiers } from './cart-item-modifiers.tsx';
import { useServerCartHasAvailableItems } from '../../../../store/zustand/server-cart.js';

interface ICartItemDetailCellsProps {
    item: ICartItemRecord;
}

/**
 * Shared table cells for a cart item row: quantity, name (with optional
 * modifiers/instructions/unavailable badge), and price.
 *
 * Does not include the first column (controls) — that varies by context.
 */
export const CartItemDetailCells: React.FC<ICartItemDetailCellsProps> = ({ item }) => {
    const price = useCartItemPrice(item);
    // Only show 'unavailable' text if there are any items in the cart that ARE available.
    const cartHasAnyAvailableItems = useServerCartHasAvailableItems();

    return (
        <>
            <td className="quantity">
                {item.quantity}x
            </td>
            <td className="name">
                <div className="full-details">
                    <span>
                        {item.menuItem.name}
                    </span>
                    {!item.isAvailable && cartHasAnyAvailableItems && <span className="cart-item-unavailable">Unavailable</span>}
                    <CartItemModifiers item={item}/>
                </div>
            </td>
            <td className="price">
                {formatPrice(price)}
            </td>
        </>
    );
};
