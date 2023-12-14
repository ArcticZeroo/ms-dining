import React from 'react';
import { getPriceDisplay } from '../../../../../util/cart.ts';

interface IOrderPopupFooterProps {
    isUpdate: boolean;
    totalPrice: number;
    quantity: number;
    isOrderValid: boolean;
    onAddToCartClicked: () => void;
    onAddQuantityClicked: () => void;
    onRemoveQuantityClicked: () => void;
}

export const OrderPopupFooter: React.FC<IOrderPopupFooterProps> = ({
                                                                       isUpdate,
                                                                       totalPrice,
                                                                       quantity,
                                                                       isOrderValid,
                                                                       onAddToCartClicked,
                                                                       onAddQuantityClicked,
                                                                       onRemoveQuantityClicked
                                                                   }) => {
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
            </div>
            <div className="quantity">
                {quantity}x
            </div>
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
    );
}