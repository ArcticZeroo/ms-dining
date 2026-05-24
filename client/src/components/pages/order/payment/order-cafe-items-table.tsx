import type { ICartItemRecord } from '@msdining/common/models/cart';
import React from 'react';
import CartItemRow from '../cart/cart-item-row.tsx';

interface IOrderCafeItemsTableProps {
    items: ICartItemRecord[];
    readOnly: boolean;
    onRemove: (item: ICartItemRecord) => void;
    onEdit: (item: ICartItemRecord) => void;
    onChangeQuantity: (item: ICartItemRecord, quantity: number) => void;
}

export const OrderCafeItemsTable: React.FC<IOrderCafeItemsTableProps> = ({
    items,
    readOnly,
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
        </tbody>
    </table>
);
