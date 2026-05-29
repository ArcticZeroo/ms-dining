import React, { useContext, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { IRecentOrderSummary } from '@msdining/common/models/order';
import type { ICafe } from '../../models/cafe.ts';
import { ApplicationContext } from '../../context/app.ts';
import { useIsLoggedIn } from '../../hooks/auth.ts';
import { useRecentOrdersQuery } from '../../store/queries/ordering.ts';

import './recent-order-banner.css';

const RECENT_ORDER_WINDOW_MS = 30 * 60 * 1000;

const isOrderWithinRecentWindow = (orderData: IRecentOrderSummary) =>
    Date.now() - orderData.completedAt.getTime() <= RECENT_ORDER_WINDOW_MS;

const getCafeName = (cafeId: string, cafes: ICafe[]) =>
    cafes.find(cafe => cafe.id === cafeId)?.name ?? cafeId;

export const RecentOrderBanner = () => {
    const isLoggedIn = useIsLoggedIn();
    const { cafes } = useContext(ApplicationContext);
    const recentOrdersQuery = useRecentOrdersQuery();
    const [isDismissed, setIsDismissed] = useState(false);

    const recentOrders = useMemo(
        () => (recentOrdersQuery.data ?? []).filter(isOrderWithinRecentWindow),
        [recentOrdersQuery.data],
    );

    if (!isLoggedIn || isDismissed || recentOrders.length === 0) {
        return null;
    }

    const firstRecentOrder = recentOrders[0]!;
    const bannerMessage = recentOrders.length === 1
        ? `Your order from ${getCafeName(firstRecentOrder.cafeId, cafes)} is being prepared`
        : `You have ${recentOrders.length} orders being prepared`;

    return (
        <div className="card recent-order-banner">
            <div className="recent-order-banner__body">
                <div className="recent-order-banner__content">
                    <span className="recent-order-banner__emoji" aria-hidden="true">🍽️</span>
                    <span>{bannerMessage}</span>
                </div>
                <div className="recent-order-banner__actions">
                    <Link to="/order/done" className="default-button default-container">
                        See details
                    </Link>
                    <button
                        type="button"
                        className="recent-order-banner__dismiss"
                        aria-label="Dismiss recent order banner"
                        onClick={() => setIsDismissed(true)}
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
