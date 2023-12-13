import { useValueNotifierContext } from '../../../../../../hooks/events.ts';
import { CartContext } from '../../../../../../context/cart.ts';

import './cart-button.css';
import { classNames } from '../../../../../../util/react.ts';

export const CartPopup = () => {
    const cartItems = useValueNotifierContext(CartContext);

    return (
        <div className={classNames('cart-button', cartItems.length === 0 && 'empty')}>
            <span className="material-symbols-outlined">
                shopping_cart
            </span>
            <span className="cart-count">
                {cartItems.length}
            </span>
            <div>
                {cartItems.map(cartItem => <div>{cartItem.itemName}</div>)}
            </div>
        </div>
    );
};