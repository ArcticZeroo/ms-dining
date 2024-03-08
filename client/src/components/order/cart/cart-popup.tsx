import { useMemo } from 'react';
import { CartContext, CartHydrationContext } from '../../../context/cart.ts';
import { useValueNotifierContext } from '../../../hooks/events.ts';
import { classNames } from '../../../util/react.ts';
import { Link } from 'react-router-dom';
import { CartContentsTable } from './cart-contents-table.tsx';
import { WaitTime } from '../wait-time.tsx';
import { PromiseStage } from '@arcticzeroo/react-promise-hook';
import { CartHydrationView } from './cart-hydration-view.tsx';

import './cart-popup.css';

export const CartPopup = () => {
    const cart = useValueNotifierContext(CartContext);
    const cartHydration = useValueNotifierContext(CartHydrationContext);

    const totalItemCount = useMemo(
        () => Array.from(cart.values()).reduce((total, itemsById) => total + itemsById.size, 0),
        [cart]
    );

    if (cartHydration.stage === PromiseStage.running) {
        return (
            <div className="cart-popup loading">
                <span className="material-symbols-outlined">
                    shopping_cart
                </span>
                <span>
                    Loading...
                </span>
            </div>
        );
    }

    const hasMissingItems = cartHydration.missingItemsByCafeId != null && cartHydration.missingItemsByCafeId.size > 0;
    const isEmpty = cartHydration.missingItemsByCafeId?.size === 0 && totalItemCount === 0;

    return (
        <div className={classNames('cart-popup', isEmpty && 'empty', hasMissingItems && 'has-missing-items')}>
            <div className="cart-info">
                {
                    hasMissingItems && (
                        <span className="cart-warning material-symbols-outlined" title="Some cart items could not be loaded">
                            error
                        </span>
                    )
                }
                <span className="material-symbols-outlined">
                    shopping_cart
                </span>
                <span className="cart-count">
                    {totalItemCount}
                </span>
            </div>
            <div className="cart-body">
                {
                    totalItemCount > 0 && (
                        <>
                            <CartContentsTable/>
                            <WaitTime/>
                            <Link to="/order" className="checkout-button">
                                Checkout
                            </Link>
                        </>
                    )
                }
                <CartHydrationView/>
            </div>
        </div>
    );
};