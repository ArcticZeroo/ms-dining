import type { ICartItemRecord } from '@msdining/common/models/cart';
import React from 'react';
import { formatPrice } from '../../../../util/cart.ts';
import { useCartItemPrice } from '../../../../hooks/cart.ts';
import { CartItemModifiers } from './cart-item-modifiers.tsx';

interface ICartItemDetailCellsProps {
    item: ICartItemRecord;
    showFullDetails: boolean;
}

/**
 * Shared table cells for a cart item row: quantity, name (with optional
 * modifiers/instructions/unavailable badge), and price.
 *
 * Does not include the first column (controls) — that varies by context.
 */
export const CartItemDetailCells: React.FC<ICartItemDetailCellsProps> = ({ item, showFullDetails }) => {
    const price = useCartItemPrice(item);

    return (
        <>
            <td className="quantity">
                {item.quantity}x
            </td>
            <td className="name">
                {
                    showFullDetails
                        ? (
                            <div className="full-details">
                                <span>
                                    {item.menuItem.name}
                                </span>
                                {!item.isAvailable && <span className="cart-item-unavailable">Unavailable</span>}
                                <CartItemModifiers item={item}/>
                            </div>
                        )
                        : (
                            <>
                                {item.menuItem.name}
                                {!item.isAvailable && <span className="cart-item-unavailable"> (Unavailable)</span>}
                            </>
                        )
                }
            </td>
            <td className="price">
                {formatPrice(price)}
            </td>
        </>
    );
};
