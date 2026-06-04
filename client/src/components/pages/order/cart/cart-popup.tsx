import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useIsOnlineOrderingAllowed } from '../../../../hooks/cafe.ts';
import { useCartStatus } from '../../../../hooks/cart-status.ts';
import { useClickTracker } from '../../../../hooks/pointer.ts';
import { useScrollbarWidth } from '../../../../hooks/scrollbar-size.ts';
import { useAggregatedCartEstimate } from '../../../../store/queries/ordering.ts';
import { useServerAvailableCartItemsByCafe } from '../../../../store/zustand/server-cart.ts';
import { classNames } from '../../../../util/react.ts';
import { CartContentsTable } from './cart-contents-table.tsx';
import { CartUnavailableItemsView } from './cart-unavailable-items-view.tsx';
import { WaitTimeEstimateBanner } from '../payment/wait-time-estimate.tsx';

import './cart-popup.css';
import { getErrorMessage } from '../../../../util/mutation.js';

const useCartEstimate = () => {
    const cartItemsByCafe = useServerAvailableCartItemsByCafe();
    const cafeIds = useMemo(() => cartItemsByCafe.map(group => group.cafeId), [cartItemsByCafe]);
    return useAggregatedCartEstimate(cafeIds);
}

const CartPopupBody = () => {
    const cart = useCartStatus();
    const scrollbarWidth = useScrollbarWidth();
    const [isExpanded, setIsExpanded] = useState(false);
    const popupRef = useRef<HTMLDivElement>(null);
    const estimate = useCartEstimate();

    const toggleExpanded = useCallback(() => setIsExpanded(prev => !prev), []);

    const onClickAnywhere = useCallback((isInside: boolean) => {
        if (!isInside) {
            setIsExpanded(false);
        }
    }, []);

    useClickTracker(popupRef, onClickAnywhere, isExpanded /*enabled*/);

    return (
        <div
            ref={popupRef}
            className={classNames(
                'cart-popup',
                !cart.shouldShow && 'hidden',
                isExpanded && 'expanded',
                cart.hasWarning && 'has-error',
            )}
            style={{
                right: `${scrollbarWidth}px`
            }}
        >
            <div className="cart-header cart-info" onClick={toggleExpanded}>
                {
                    cart.hasWarning && (
                        <span className="cart-warning material-symbols-outlined" title={cart.isError ? 'Failed to load cart' : 'Some cart items are no longer available'}>
                            error
                        </span>
                    )
                }
                <span className="material-symbols-outlined">
                    shopping_cart
                </span>
                <span className="cart-count">
                    {
                        cart.isLoading
                            ? 'Loading...'
                            : cart.totalItemCount
                    }
                </span>
            </div>
            <div className="cart-body">
                {
                    cart.isError && (
                        <div className="cart-hydration-error">
                            <span>
                                {getErrorMessage(cart.error, 'Failed to load your cart')}
                            </span>
                            <div className="cart-hydration-actions flex">
                                <button
                                    className="default-container default-button"
                                    onClick={() => cart.refetch()}
                                >
                                    Retry
                                </button>
                            </div>
                        </div>
                    )
                }
                {
                    cart.totalItemCount > 0 && !cart.hasUnavailableItems && (
                        <>
                            <CartContentsTable showTotalPrice/>
                            <WaitTimeEstimateBanner waitTime={estimate?.waitTime}/>
                            <Link to="/order" className="checkout-button">
                                Checkout
                            </Link>
                        </>
                    )
                }
                <CartUnavailableItemsView/>
            </div>
        </div>
    );
};

export const CartPopup = () => {
    const isOnlineOrderingAllowed = useIsOnlineOrderingAllowed();
    const location = useLocation();

    if (!isOnlineOrderingAllowed || location.pathname === '/order') {
        return;
    }

    return <CartPopupBody/>;
};
