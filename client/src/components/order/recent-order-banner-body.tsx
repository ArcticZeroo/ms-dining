import { Link } from 'react-router-dom';
import { useCallback, useContext, useMemo } from 'react';
import { useRecentOrdersQuery } from '../../store/queries/ordering.js';
import { ApplicationContext } from '../../context/app.js';
import { useValueNotifier, useValueNotifierAsState } from '../../hooks/events.js';
import { ApplicationSettings, InternalSettings } from '../../constants/settings.js';
import type { IRecentOrderSummary } from '@msdining/common/models/order';
import type { CafeView } from '../../models/cafe.js';
import Duration from '@arcticzeroo/duration';
import { getParentView } from '../../util/view.js';
import { pluralize } from '../../util/string.js';
import { getViewName } from '../../util/cafe.js';

const RECENT_ORDER_WINDOW = new Duration({ minutes: 30 });

const isOrderWithinRecentWindow = (orderData: IRecentOrderSummary) => Date.now() - orderData.completedAt.getTime() <= RECENT_ORDER_WINDOW.inMilliseconds;

const getBannerMessage = (orders: Array<IRecentOrderSummary>, viewsById: Map<string, CafeView>, shouldUseGroups: boolean) => {
    const orderViewsByParentView = new Map<CafeView, Set<CafeView>>();
    for (const order of orders) {
        const view = viewsById.get(order.cafeId);
        if (!view) {
            console.error('Missing view for cafe', order.cafeId);
            continue;
        }

        const parentView = getParentView(viewsById, view, shouldUseGroups);
        const orderViewsForParent = orderViewsByParentView.get(parentView) ?? new Set<CafeView>();
        orderViewsForParent.add(view);
        orderViewsByParentView.set(parentView, orderViewsForParent);
    }

    const baseMessage = `You have ${orders.length} ${pluralize('order', orders.length)} being prepared`;

    if (orderViewsByParentView.size === 0) {
        return baseMessage;
    }

    if (orderViewsByParentView.size === 1) {
        const [parentView, childViews] = [...orderViewsByParentView.entries()][0]!;

        if (childViews.size === 1) {
            const childView = [...childViews][0]!;
            return `${baseMessage} at ${getViewName( { view: childView, showGroupName: true })}`;
        }

        return `${baseMessage} in ${getViewName({ view: parentView, showGroupName: false })}`;
    }

    return `${baseMessage} across ${orderViewsByParentView.size} ${pluralize('location', orderViewsByParentView.size)}`;
}

export const RecentOrderBannerBody = () => {
    const { viewsById } = useContext(ApplicationContext);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);
    const recentOrdersQuery = useRecentOrdersQuery();
    const [lastOrderPrepDismissCreatedTime, setLastOrderPrepDismissCreatedTime] = useValueNotifierAsState(InternalSettings.lastOrderPrepDismissCreatedTime);

    const recentOrders = useMemo(
        () => (recentOrdersQuery.data ?? []).filter(order => isOrderWithinRecentWindow(order) && order.completedAt.getTime() > lastOrderPrepDismissCreatedTime),
        [lastOrderPrepDismissCreatedTime, recentOrdersQuery.data],
    );

    const bannerMessage = useMemo(
        () => getBannerMessage(recentOrders, viewsById, shouldUseGroups),
        [recentOrders, shouldUseGroups, viewsById]
    );

    const onDismissClicked = useCallback(() => {
        setLastOrderPrepDismissCreatedTime(Date.now());
    }, [setLastOrderPrepDismissCreatedTime]);

    if (recentOrders.length === 0) {
        return;
    }

    return (
        <div className="card dark-blue horizontal flex-between">
            <div className="flex align-center">
                <span aria-hidden="true">🍽️</span>
                <span>{bannerMessage}</span>
            </div>
            <div className="flex">
                <Link to="/order/history?range=today" className="default-button default-container">
                    See details
                </Link>
                <button
                    type="button"
                    className="icon-container default-container"
                    aria-label="Dismiss recent order banner"
                    onClick={onDismissClicked}
                >
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>
        </div>
    );
}