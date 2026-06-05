import React from 'react';
import type { IDisplayCartItem } from '../../../../store/zustand/server-cart.ts';
import { useIsCartItemBusy } from '../../../../store/queries/server-cart.ts';
import { HourglassLoadingSpinner } from '../../../icon/hourglass-loading-spinner.js';
import { classNames } from '../../../../util/react.js';
import { CartItemDetailCells } from './cart-item-detail-cells.tsx';

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
    readOnly = false
}) => {
    const isPending = item.isPending === true;
    const isBeingRemoved = useIsCartItemBusy(item.id);
    const isEffectivelyReadOnly = readOnly || !item.isAvailable || isPending || isBeingRemoved;
    const canDecreaseQuantity = !isEffectivelyReadOnly && item.quantity > 1;
    const canIncreaseQuantity = !isEffectivelyReadOnly && item.quantity < MAX_QUANTITY;

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
            {
                isPending && (
                    <td>
                        <div className="cart-item-buttons">
                            <HourglassLoadingSpinner/>
                        </div>
                    </td>
                )
            }
            <CartItemDetailCells item={item}/>
            {
                !isPending && (
                    <td>
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
                    </td>
                )
            }
        </tr>
    );
};
export default CartItemRow;
