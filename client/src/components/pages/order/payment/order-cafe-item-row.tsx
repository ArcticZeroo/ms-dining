import type { ICartItemRecord } from '@msdining/common/models/cart';
import React from 'react';
import CartItemRow from '../cart/cart-item-row.tsx';

interface IOrderCafeItemRowProps {
    readOnly: boolean;
    item: ICartItemRecord;
    onRemove: (item: ICartItemRecord) => void;
    onEdit: (item: ICartItemRecord) => void;
    onChangeQuantity: (item: ICartItemRecord, quantity: number) => void;
}

export const OrderCafeItemRow: React.FC<IOrderCafeItemRowProps> = ({
    readOnly,
    item,
    onRemove,
    onEdit,
    onChangeQuantity,
}) => {
    const handleRemove = () => onRemove(item);
    const handleEdit = () => onEdit(item);
    const handleChangeQuantity = (quantity: number) => onChangeQuantity(item, quantity);

    return (
        <CartItemRow
            item={item}
            readOnly={readOnly}
            onRemove={handleRemove}
            onEdit={handleEdit}
            onChangeQuantity={handleChangeQuantity}
        />
    );
};
