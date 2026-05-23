import type { ICafeOrderItemSummary } from '@msdining/common/models/order';
import React from 'react';
import { formatPrice } from '../../../../util/cart.ts';

interface ICompletedOrderItemsTableProps {
    items: ICafeOrderItemSummary[];
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
                        <td className="quantity">
                            {item.quantity}x
                        </td>
                        <td className="name">
                            <div className="full-details">
                                <span>{item.name}</span>
                                {
                                    item.specialInstructions && (
                                        <span className="cart-item-special-instructions">
                                            {item.specialInstructions}
                                        </span>
                                    )
                                }
                            </div>
                        </td>
                        <td className="price">
                            {formatPrice(item.price * item.quantity)}
                        </td>
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
