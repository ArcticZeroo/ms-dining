import React from 'react';
import { ICartItemWithMetadata } from '../../../models/cart.ts';
import { formatPrice } from '../../../util/cart.ts';
import { CartItemModifiers } from './cart-item-modifiers.tsx';

const MAX_QUANTITY = 99;

const READONLY_TITLE = 'Order has been submitted for preparation';

const getDecreaseTitle = (readOnly: boolean, canDecrease: boolean) => {
    if (readOnly) return READONLY_TITLE;
    if (canDecrease) return 'Remove one more';
    return 'Use the trash can to remove this item';
};

const getIncreaseTitle = (readOnly: boolean, canIncrease: boolean) => {
    if (readOnly) return READONLY_TITLE;
    if (canIncrease) return 'Add one more';
    return 'You can only order up to 99 of each item';
};

interface ICartItemProps {
    showFullDetails: boolean;
    readOnly?: boolean;
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
    showFullDetails,
    readOnly = false
}) => {
    const canDecreaseQuantity = !readOnly && item.quantity > 1;
    const canIncreaseQuantity = !readOnly && item.quantity < MAX_QUANTITY;

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
                        disabled={readOnly}
                        title={readOnly ? READONLY_TITLE : 'Remove this item'}
                    >
                        delete
                    </button>
                    <button
                        className="material-symbols-outlined"
                        disabled={!canDecreaseQuantity}
                        onClick={onDecreaseQuantity}
                        title={getDecreaseTitle(readOnly, canDecreaseQuantity)}
                    >
                        remove
                    </button>
                    <button
                        className="material-symbols-outlined"
                        disabled={!canIncreaseQuantity}
                        onClick={onIncreaseQuantity}
                        title={getIncreaseTitle(readOnly, canIncreaseQuantity)}
                    >
                        add
                    </button>
                    <button
                        className="material-symbols-outlined"
                        onClick={onEdit}
                        disabled={readOnly}
                        title={readOnly ? READONLY_TITLE : 'Edit this item'}
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