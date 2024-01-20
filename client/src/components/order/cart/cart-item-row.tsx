import React from 'react';
import { ICartItemWithMetadata } from '../../../models/cart.ts';
import { getPriceDisplay } from '../../../util/cart.ts';

interface ICartItemProps {
    item: ICartItemWithMetadata;
    onRemove: () => void;
    onEdit: () => void;
    onChangeQuantity: (quantity: number) => void;
}

export const CartItemRow: React.FC<ICartItemProps> = ({ item, onRemove, onEdit, onChangeQuantity }) => {
    const canDecreaseQuantity = item.quantity > 1;

    const onDecreaseQuantity = () => {
        if (!canDecreaseQuantity) {
            return;
        }

        onChangeQuantity(item.quantity - 1);
    }

    return (
        <tr className="cart-item">
            <td>
                <div className="cart-item-buttons">
                    <button
                        className="material-symbols-outlined"
                        onClick={onRemove}
                        title="Remove this item"
                    >
                        delete
                    </button>
                    <button
                        className="material-symbols-outlined"
                        disabled={!canDecreaseQuantity}
                        onClick={onDecreaseQuantity}
                        title={canDecreaseQuantity ? 'Remove one' : 'Use the trash can to remove this item'}
                    >
                        remove
                    </button>
                    <button
                        className="material-symbols-outlined"
                        onClick={() => onChangeQuantity(item.quantity + 1)}
                    >
                        add
                    </button>
                    <button
                        className="material-symbols-outlined"
                        onClick={onEdit}
                        title="Edit this item"
                    >
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