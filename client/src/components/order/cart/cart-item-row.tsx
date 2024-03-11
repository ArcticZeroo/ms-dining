import React from 'react';
import { ICartItemWithMetadata } from '../../../models/cart.ts';
import { formatPrice } from '../../../util/cart.ts';
import { CartItemModifiers } from './cart-item-modifiers.tsx';

const MAX_QUANTITY = 99;

interface ICartItemProps {
    showFullDetails: boolean;
    item: ICartItemWithMetadata;
    onRemove: () => void;
    onEdit: () => void;
    onChangeQuantity: (quantity: number) => void;
}

export const CartItemRow: React.FC<ICartItemProps> = ({
    item,
    onRemove,
    onEdit,
    onChangeQuantity,
    showFullDetails
}) => {
    const canDecreaseQuantity = item.quantity > 1;
    const canIncreaseQuantity = item.quantity < MAX_QUANTITY;

    const onDecreaseQuantity = () => {
        if (!canDecreaseQuantity) {
            return;
        }

        onChangeQuantity(item.quantity - 1);
    };

    const onIncreaseQuantity = () => {
        if (!canIncreaseQuantity) {
            return;
        }

        onChangeQuantity(item.quantity + 1);
    };

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
                        title={canDecreaseQuantity ? 'Remove one more' : 'Use the trash can to remove this item'}
                    >
                        remove
                    </button>
                    <button
                        className="material-symbols-outlined"
                        disabled={!canIncreaseQuantity}
                        onClick={onIncreaseQuantity}
                        title={canIncreaseQuantity ? 'Add one more' : 'You can only order up to 99 of each item'}
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
            <td className="quantity">
                {item.quantity}x
            </td>
            <td className="name">
                {
                    showFullDetails
                        ? (
                            <div className="full-details">
                                <span>
                                    {item.associatedItem.name}
                                </span>
                                <CartItemModifiers item={item}/>
                            </div>
                        )
                        : item.associatedItem.name
                }
            </td>
            <td className="price">
                {formatPrice(item.price * item.quantity)}
            </td>
        </tr>
    );
};