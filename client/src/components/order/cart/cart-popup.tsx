import { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCartStore } from '../../../store/zustand/cart.ts';
import { useCartHydrationStatus } from '../../../store/queries/cart.ts';
import { useIsOnlineOrderingAllowed } from '../../../hooks/cafe.ts';
import { useClickTracker } from '../../../hooks/pointer.ts';
import { useScrollbarWidth } from '../../../hooks/scrollbar-size.ts';
import { classNames } from '../../../util/react.ts';
import { WaitTime } from '../wait-time.tsx';
import { CartContentsTable } from './cart-contents-table.tsx';
import { CartHydrationView } from './cart-hydration-view.tsx';

import './cart-popup.css';

export const CartPopup = () => {
    const isOnlineOrderingAllowed = useIsOnlineOrderingAllowed();
    const cart = useCartStore((state) => state.items);
    const missingItemsByCafeId = useCartStore((state) => state.missingItemsByCafeId);
    const hydrationStatus = useCartHydrationStatus();
    const scrollbarWidth = useScrollbarWidth();
    const [isExpanded, setIsExpanded] = useState(false);
    const popupRef = useRef<HTMLDivElement>(null);

    const totalItemCount = useMemo(
        () => Array.from(cart.values()).reduce((total, itemsById) => total + itemsById.size, 0),
        [cart]
    );

    const toggleExpanded = useCallback(() => setIsExpanded(prev => !prev), []);

    const onClickAnywhere = useCallback((isInside: boolean) => {
        if (!isInside) {
            setIsExpanded(false);
        }
    }, []);

    useClickTracker(popupRef, onClickAnywhere, isExpanded /*enabled*/);

    if (!isOnlineOrderingAllowed) {
        return;
    }

    const hasMissingItems = missingItemsByCafeId.size > 0;
    const shouldShow = totalItemCount > 0 || hasMissingItems || hydrationStatus.isPending;

    return (
        <div
            ref={popupRef}
            className={classNames(
                'cart-popup',
                !shouldShow && 'hidden',
                isExpanded && 'expanded',
                hasMissingItems && 'has-missing-items'
            )}
            style={{
                right: `${scrollbarWidth}px`
            }}
        >
            <div className="cart-header cart-info" onClick={toggleExpanded}>
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
                        hydrationStatus.isPending
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