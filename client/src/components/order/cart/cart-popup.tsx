import { useMemo } from 'react';
import { CartContext } from '../../../context/cart.ts';
import { useValueNotifierContext } from '../../../hooks/events.ts';

import { classNames } from '../../../util/react.ts';

import './cart-popup.css';
import { Link } from 'react-router-dom';
import { CartContentsTable } from './cart-contents-table.tsx';
import { WaitTime } from '../wait-time.tsx';


export const CartPopup = () => {
    const cart = useValueNotifierContext(CartContext);

    const totalItemCount = useMemo(
        () => Array.from(cart.values()).reduce((total, itemsById) => total + itemsById.size, 0),
        [cart]
    );

    return (
        <div className={classNames('cart-popup', totalItemCount === 0 && 'empty')}>
            <div className="cart-info">
                <span className="material-symbols-outlined">
                    shopping_cart
                </span>
                <span className="cart-count">
                    {totalItemCount}
                </span>
            </div>
            <div className="cart-body">
                <CartContentsTable/>
                <WaitTime/>
                <Link to="/order" className="checkout-button">
                    Checkout
                </Link>
            </div>
        </div>
    );
};