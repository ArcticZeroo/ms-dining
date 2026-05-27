import { useContext, useMemo, useState } from 'react';
import type { OrderHistorySince } from '../../../../api/ordering.ts';
import { ApplicationSettings } from '../../../../constants/settings.ts';
import { ApplicationContext } from '../../../../context/app.ts';
import { useValueNotifier } from '../../../../hooks/events.ts';
import { usePageData } from '../../../../hooks/location.ts';
import { useOrderHistoryQuery } from '../../../../store/queries/ordering.ts';
import { formatPrice } from '../../../../util/cart.ts';
import { pluralize } from '../../../../util/string.ts';
import { OrderHistoryFilters } from './order-history-filters.tsx';
import { useExpandedViewIds } from '../../../../hooks/search.js';
import { OrderHistoryBody } from './order-history-body.tsx';
import './order-history-view.css';

export const OrderHistoryView = () => {
    const [selectedSince, setSelectedSince] = useState<OrderHistorySince>('30d');
    const [isHomepageOnly, setIsHomepageOnly] = useState(false);
    const homepageViewIds = useValueNotifier(ApplicationSettings.homepageViews);
    const { viewsById } = useContext(ApplicationContext);
    const historyQuery = useOrderHistoryQuery(selectedSince);

    usePageData('Order History', 'Browse your past dining orders.');

    const hasHomepageViews = homepageViewIds.size > 0;
    const expandedHomepageViewIds = useExpandedViewIds(homepageViewIds, viewsById);

    const visibleOrders = useMemo(() => {
        const orders = historyQuery.data ?? [];
        return orders.filter((orderData) => !isHomepageOnly || expandedHomepageViewIds.has(orderData.cafeId));
    }, [historyQuery.data, isHomepageOnly, expandedHomepageViewIds]);

    const totalSpent = useMemo(
        () => visibleOrders.reduce((total, orderData) => total + orderData.total, 0),
        [visibleOrders]
    );

    const hasData = historyQuery.data != null;

    return (
        <div id="order-history" className="flex-col">
            <div className="card flex-col">
                <div className="title text-center">Order History</div>
                <OrderHistoryFilters
                    selectedSince={selectedSince}
                    onSinceChanged={setSelectedSince}
                    isHomepageOnly={isHomepageOnly}
                    onHomepageOnlyChanged={setIsHomepageOnly}
                    hasHomepageViews={hasHomepageViews}
                />
                {hasData && (
                    <div className="order-history-summary subtitle text-center">
                        {visibleOrders.length} {pluralize('order', visibleOrders.length)} • {formatPrice(totalSpent)} total
                    </div>
                )}
            </div>
            <OrderHistoryBody
                orders={visibleOrders}
                isLoading={historyQuery.isPending}
                isFetching={historyQuery.isFetching}
                isError={historyQuery.isError}
                error={historyQuery.error}
                onRetry={() => historyQuery.refetch()}
            />
        </div>
    );
};
