import { ICartItemWithMetadata } from "../../../../../../models/cart";
import { getPriceDisplay } from '../../../../../../util/cart.ts';
import React from 'react';

interface ICartItemProps {
    item: ICartItemWithMetadata;
    onRemove: () => void;
    onEdit: () => void;
    onChangeQuantity: (quantity: number) => void;
}

export const CartItemRow: React.FC<ICartItemProps> = ({ item, onRemove, onEdit, onChangeQuantity }) => {
    return (
        <tr className="cart-item">
            <td>
                <div className="cart-item-buttons">
                    <button className="material-symbols-outlined" onClick={onRemove}>
                        delete
                    </button>
                    <button className="material-symbols-outlined" onClick={() => onChangeQuantity(item.quantity - 1)}>
                        remove
                    </button>
                    <button className="material-symbols-outlined" onClick={() => onChangeQuantity(item.quantity + 1)}>
                        add
                    </button>
                    <button className="material-symbols-outlined" onClick={onEdit}>
                        edit
                    </button>
                </div>
            </td>
            <td>
                {item.quantity}x
            </td>
            <td className="name">
                {item.associatedItem.name}
            </td>
            <td className="price">
                {getPriceDisplay(item.price * item.quantity)}
            </td>
        </tr>
    );
}