import React from 'react';
import { calculatePrice, formatPrice } from '../../../../util/cart.ts';
import { CartItemModifiers } from './cart-item-modifiers.tsx';
import type { IDisplayCartItem } from '../../../../store/zustand/server-cart.ts';
import { HourglassLoadingSpinner } from '../../../icon/hourglass-loading-spinner.js';
import { classNames } from '../../../../util/react.js';

const MAX_QUANTITY = 99;

const READONLY_TITLE = 'Order has been submitted for preparation';

const getDecreaseTitle = (readOnly: boolean, canDecrease: boolean) => {
    if (readOnly) {
        return READONLY_TITLE;
    }
    if (canDecrease) {
        return 'Remove one more';
    }
    return 'Use the trash can to remove this item';
};

const getIncreaseTitle = (readOnly: boolean, canIncrease: boolean) => {
    if (readOnly) {
        return READONLY_TITLE;
    }
    if (canIncrease) {
        return 'Add one more';
    }
    return 'You can only order up to 99 of each item';
};

interface ICartItemProps {
    showFullDetails: boolean;
    readOnly?: boolean;
    item: IDisplayCartItem;
    onRemove: () => void;
    onEdit: () => void;
    onChangeQuantity: (quantity: number) => void;
}

const CartItemRow: React.FC<ICartItemProps> = ({
    item,
    onRemove,
    onEdit,
    onChangeQuantity,
    showFullDetails,
    readOnly = false
}) => {
    const isPending = item.isPending === true;
    const isEffectivelyReadOnly = readOnly || !item.isAvailable || isPending;
    const canDecreaseQuantity = !isEffectivelyReadOnly && item.quantity > 1;
    const canIncreaseQuantity = !isEffectivelyReadOnly && item.quantity < MAX_QUANTITY;
    const price = calculatePrice(
        item.menuItem,
        new Map(item.modifiers.map(modifier => [modifier.modifierId, new Set(modifier.choiceIds)])),
    );

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
        <tr className={classNames('cart-item', !item.isAvailable && 'unavailable', isPending && 'pending')} title={isPending ? 'Adding this item to your cart...' : ''}>
            <td>
                {
                    isPending && (
                        <div className="cart-item-buttons">
                            <HourglassLoadingSpinner/>
                        </div>
                    )
                }
                {
                    !isPending && (
                        <div className="cart-item-buttons">
                            <button
                                className="material-symbols-outlined"
                                onClick={onRemove}
                                disabled={isEffectivelyReadOnly}
                                title={isEffectivelyReadOnly ? READONLY_TITLE : 'Remove this item'}
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
                                disabled={isEffectivelyReadOnly}
                                title={isEffectivelyReadOnly ? (item.isAvailable ? READONLY_TITLE : 'Item is no longer available') : 'Edit this item'}
                            >
                                edit
                            </button>
                        </div>
                    )
                }
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
                {formatPrice(price * item.quantity)}
            </td>
        </tr>
    );
};
export default CartItemRow;
