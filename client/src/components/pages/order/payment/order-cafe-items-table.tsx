import type { ICartItemRecord } from '@msdining/common/models/cart';
import React from 'react';
import { formatPrice } from '../../../../util/cart.ts';
import CartItemRow from '../cart/cart-item-row.tsx';

interface IOrderCafeItemsTableProps {
    items: ICartItemRecord[];
    readOnly: boolean;
    totalPrice: number;
    onRemove: (item: ICartItemRecord) => void;
    onEdit: (item: ICartItemRecord) => void;
    onChangeQuantity: (item: ICartItemRecord, quantity: number) => void;
}

export const OrderCafeItemsTable: React.FC<IOrderCafeItemsTableProps> = ({
    items,
    readOnly,
    totalPrice,
    onRemove,
    onEdit,
    onChangeQuantity,
}) => (
    <table className="cart-contents">
        <tbody>
            {items.map((item) => (
                <CartItemRow
                    key={item.id}
                    item={item}
                    readOnly={readOnly}
                    onRemove={() => onRemove(item)}
                    onEdit={() => onEdit(item)}
                    onChangeQuantity={(quantity) => onChangeQuantity(item, quantity)}
                />
            ))}
            <tr>
                <td colSpan={2}></td>
                <td>Subtotal</td>
                <td className="price">{formatPrice(totalPrice)}</td>
            </tr>
            <tr>
                <td colSpan={2}></td>
                <td>Tax</td>
                <td className="price">Calculated at checkout</td>
            </tr>
        </tbody>
    </table>
);
