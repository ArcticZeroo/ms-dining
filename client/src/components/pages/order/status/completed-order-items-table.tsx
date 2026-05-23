import type { ICafeOrderItem } from '@msdining/common/models/order';
import React from 'react';
import { formatPrice } from '../../../../util/cart.ts';
import { CartItemDetailCells } from '../cart/cart-item-detail-cells.tsx';

interface ICompletedOrderItemsTableProps {
    items: ICafeOrderItem[];
    subtotal: number;
    tax: number;
    total: number;
}

export const CompletedOrderItemsTable: React.FC<ICompletedOrderItemsTableProps> = ({ items, subtotal, tax, total }) => {
    if (items.length === 0) {
        return null;
    }

    return (
        <table className="cart-contents">
            <tbody>
                {items.map((item, i) => (
                    <tr key={i} className="cart-item">
                        <CartItemDetailCells item={item}/>
                    </tr>
                ))}
                <tr>
                    <td></td>
                    <td>Subtotal</td>
                    <td className="price">{formatPrice(subtotal)}</td>
                </tr>
                <tr>
                    <td></td>
                    <td>Tax</td>
                    <td className="price">{formatPrice(tax)}</td>
                </tr>
                <tr>
                    <td></td>
                    <td><strong>Total</strong></td>
                    <td className="price"><strong>{formatPrice(total)}</strong></td>
                </tr>
            </tbody>
        </table>
    );
};
