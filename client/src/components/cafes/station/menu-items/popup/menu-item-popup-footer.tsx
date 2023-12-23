import React from 'react';
import { ApplicationSettings } from '../../../../../api/settings.ts';
import { useValueNotifier } from '../../../../../hooks/events.ts';
import { getPriceDisplay } from '../../../../../util/cart.ts';

interface IMenuItemPopupFooterProps {
    isUpdate: boolean;
    totalPrice: number;
    quantity: number;
    isOrderValid: boolean;
    onAddToCartClicked: () => void;
    onAddQuantityClicked: () => void;
    onRemoveQuantityClicked: () => void;
}

export const MenuItemPopupFooter: React.FC<IMenuItemPopupFooterProps> = ({
                                                                       isUpdate,
                                                                       totalPrice,
                                                                       quantity,
                                                                       isOrderValid,
                                                                       onAddToCartClicked,
                                                                       onAddQuantityClicked,
                                                                       onRemoveQuantityClicked
                                                                   }) => {
    const isOnlineOrderingAllowed = useValueNotifier(ApplicationSettings.allowOnlineOrdering);

    if (!isOnlineOrderingAllowed) {
        return null;
    }

    const canDecreaseQuantity = quantity > 1;

    return (
        <div className="menu-item-order-footer">
            <div className="controls">
                <button className="material-symbols-outlined"
                        disabled={!canDecreaseQuantity}
                        onClick={onRemoveQuantityClicked}>
                    remove
                </button>
                <button className="material-symbols-outlined"
                        onClick={onAddQuantityClicked}>
                    add
                </button>
                <div className="quantity">
                    {quantity}x
                </div>
            </div>
            <div className="info">
                <div className="price">
                    {getPriceDisplay(totalPrice * quantity)}
                </div>
                <button className="add-to-cart"
                        disabled={!isOrderValid}
                        title={isOrderValid ? 'Click to add to cart' : 'Finish choosing options before adding to your cart!'}
                        onClick={onAddToCartClicked}
                >
                    {
                        isUpdate
                            ? 'Update Cart Item'
                            : 'Add to Cart'
                    }
                </button>
            </div>
        </div>
    );
}