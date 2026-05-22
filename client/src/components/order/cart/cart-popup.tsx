import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useIsOnlineOrderingAllowed } from '../../../hooks/cafe.ts';
import { useClickTracker } from '../../../hooks/pointer.ts';
import { useScrollbarWidth } from '../../../hooks/scrollbar-size.ts';
import { useCartQuery } from '../../../store/queries/server-cart.ts';
import {
    useServerCartActiveOrder,
    useServerCartHasUnavailableItems,
    useServerCartItemCount,
} from '../../../store/zustand/server-cart.ts';
import { classNames } from '../../../util/react.ts';
import { CartContentsTable } from './cart-contents-table.tsx';
import { CartHydrationView } from './cart-hydration-view.tsx';

import './cart-popup.css';

const CartPopupBody = () => {
    const totalItemCount = useServerCartItemCount();
    const hasUnavailableItems = useServerCartHasUnavailableItems();
    const activeOrder = useServerCartActiveOrder();
    const cartQuery = useCartQuery();
    const scrollbarWidth = useScrollbarWidth();
    const [isExpanded, setIsExpanded] = useState(false);
    const popupRef = useRef<HTMLDivElement>(null);

    const toggleExpanded = useCallback(() => setIsExpanded(prev => !prev), []);

    const onClickAnywhere = useCallback((isInside: boolean) => {
        if (!isInside) {
            setIsExpanded(false);
        }
    }, []);

    useClickTracker(popupRef, onClickAnywhere, isExpanded /*enabled*/);

    const hasActiveOrder = activeOrder != null;
    const shouldShow = totalItemCount > 0 || hasUnavailableItems || hasActiveOrder || cartQuery.isPending || cartQuery.isError;
    const hasWarning = hasUnavailableItems || cartQuery.isError;

    return (
        <div
            ref={popupRef}
            className={classNames(
                'cart-popup',
                !shouldShow && 'hidden',
                isExpanded && 'expanded',
                hasWarning && 'has-error',
                hasActiveOrder && !hasWarning && 'has-active-order',
            )}
            style={{
                right: `${scrollbarWidth}px`
            }}
        >
            <div className="cart-header cart-info" onClick={toggleExpanded}>
                {
                    hasWarning && (
                        <span className="cart-warning material-symbols-outlined" title={cartQuery.isError ? 'Failed to load cart' : 'Some cart items are no longer available'}>
                            error
                        </span>
                    )
                }
                {
                    hasActiveOrder && !hasWarning && (
                        <span className="cart-warning material-symbols-outlined" title="You have an order in progress">
                            info
                        </span>
                    )
                }
                <span className="material-symbols-outlined">
                    shopping_cart
                </span>
                <span className="cart-count">
                    {
                        cartQuery.isPending
                            ? 'Loading...'
                            : totalItemCount
                    }
                </span>
            </div>
            <div className="cart-body">
                {
                    cartQuery.isError && (
                        <div className="cart-hydration-error">
                            <span>Failed to load your cart.</span>
                            <div className="cart-hydration-actions flex">
                                <button
                                    className="default-container default-button"
                                    onClick={() => cartQuery.refetch()}
                                >
                                    Retry
                                </button>
                            </div>
                        </div>
                    )
                }
                {
                    hasActiveOrder && (
                        <div className="cart-active-order">
                            <span>You have an order in progress.</span>
                            <Link to={`/order/${activeOrder.orderSessionId}/pay`} className="checkout-button">
                                Continue Order
                            </Link>
                        </div>
                    )
                }
                {
                    totalItemCount > 0 && (
                        <>
                            <CartContentsTable showFullDetails={true}/>
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

export const CartPopup = () => {
    const isOnlineOrderingAllowed = useIsOnlineOrderingAllowed();

    if (!isOnlineOrderingAllowed) {
        return;
    }

    return <CartPopupBody/>;
};
