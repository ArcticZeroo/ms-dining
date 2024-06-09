import React from 'react';
import { formatPrice } from '../../../../../util/cart.ts';

interface IMenuItemPopupFooterProps {
    isUpdate: boolean;
    totalPrice: number;
    quantity: number;
    isOrderValid: boolean;
    isOnlineOrderingAllowed: boolean;
    onAddToCartClicked: () => void;
    onAddQuantityClicked: () => void;
    onRemoveQuantityClicked: () => void;
}

export const MenuItemPopupFooter: React.FC<IMenuItemPopupFooterProps> = ({
    isUpdate,
    totalPrice,
    quantity,
    isOrderValid,
    isOnlineOrderingAllowed,
    onAddToCartClicked,
    onAddQuantityClicked,
    onRemoveQuantityClicked
}) => {
    const canDecreaseQuantity = quantity > 1;

    return (
        <div className="menu-item-order-footer">
            <div className="controls">
                <button
                    disabled={!canDecreaseQuantity}
                    onClick={onRemoveQuantityClicked}>
                    <span className="material-symbols-outlined">
                        remove
                    </span>
                </button>
                <button
                    onClick={onAddQuantityClicked}>
                    <span className="material-symbols-outlined">
                        add
                    </span>
                </button>
                <div className="quantity">
                    {quantity}x
                </div>
            </div>
            <div className="info">
                <div className="price">
                    {formatPrice(totalPrice * quantity)}
                </div>
                {
                    isOnlineOrderingAllowed && (
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
                    )
                }
            </div>
        </div>
    );
}