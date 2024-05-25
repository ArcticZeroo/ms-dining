import { PromiseStage } from '@arcticzeroo/react-promise-hook';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CartContext, CartHydrationContext } from '../../../context/cart.ts';
import { useIsTodaySelected } from '../../../hooks/date-picker.tsx';
import { useValueNotifier, useValueNotifierContext } from '../../../hooks/events.ts';
import { useScrollbarWidth } from '../../../hooks/scrollbar-size.ts';
import { classNames } from '../../../util/react.ts';
import { WaitTime } from '../wait-time.tsx';
import { CartContentsTable } from './cart-contents-table.tsx';
import { CartHydrationView } from './cart-hydration-view.tsx';
import { DebugSettings } from '../../../constants/settings.ts';

import './cart-popup.css';

export const CartPopup = () => {
    const allowOnlineOrdering = useValueNotifier(DebugSettings.allowOnlineOrdering);
    const cart = useValueNotifierContext(CartContext);
    const cartHydration = useValueNotifierContext(CartHydrationContext);
    const isTodaySelected = useIsTodaySelected();
    const scrollbarWidth = useScrollbarWidth();

    const totalItemCount = useMemo(
        () => Array.from(cart.values()).reduce((total, itemsById) => total + itemsById.size, 0),
        [cart]
    );

    const hasMissingItems = cartHydration.missingItemsByCafeId != null && cartHydration.missingItemsByCafeId.size > 0;
    const shouldShow = isTodaySelected && (totalItemCount > 0 || hasMissingItems || cartHydration.stage === PromiseStage.running);

    if (!allowOnlineOrdering) {
        return;
    }

    return (
        <div
            className={classNames(
                'cart-popup',
                !shouldShow && 'hidden',
                hasMissingItems && 'has-missing-items'
            )}
            style={{
                right: `${scrollbarWidth}px`
            }}
        >
            <div className="cart-header cart-info">
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
                    {
                        cartHydration.stage === PromiseStage.running
                            ? 'Loading...'
                            : totalItemCount
                    }
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