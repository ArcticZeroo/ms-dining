import { useContext, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { OrderHistorySince } from '../../../../api/ordering.ts';
import { ApplicationSettings } from '../../../../constants/settings.ts';
import { ApplicationContext } from '../../../../context/app.ts';
import { useValueNotifier } from '../../../../hooks/events.ts';
import { usePageData } from '../../../../hooks/location.ts';
import { useOrderHistoryQuery } from '../../../../store/queries/ordering.ts';
import { OrderHistoryFilters } from './order-history-filters.tsx';
import { useExpandedViewIds } from '../../../../hooks/search.js';
import { OrderHistoryBody } from './order-history-body.tsx';
import './order-history-view.css';

interface IOrderHistoryViewProps {
    title: string;
    pageDescription: string;
    defaultSince?: OrderHistorySince;
    showFilters?: boolean;
    showHistoryLink?: boolean;
}

export const OrderHistoryView = ({
    title,
    pageDescription,
    defaultSince = '30d',
    showFilters = true,
    showHistoryLink = false,
}: IOrderHistoryViewProps) => {
    const [selectedSince, setSelectedSince] = useState<OrderHistorySince>(defaultSince);
    const [isHomepageOnly, setIsHomepageOnly] = useState(false);
    const homepageViewIds = useValueNotifier(ApplicationSettings.homepageViews);
    const { viewsById } = useContext(ApplicationContext);
    const historyQuery = useOrderHistoryQuery(selectedSince);

    usePageData(title, pageDescription);

    const hasHomepageViews = homepageViewIds.size > 0;
    const expandedHomepageViewIds = useExpandedViewIds(homepageViewIds, viewsById);

    const visibleOrders = useMemo(() => {
        const orders = historyQuery.data ?? [];
        return orders.filter((orderData) => !isHomepageOnly || expandedHomepageViewIds.has(orderData.cafeId));
    }, [historyQuery.data, isHomepageOnly, expandedHomepageViewIds]);

    return (
        <div id="order-history" className="flex-col">
            <div className="card flex-col">
                <div className="title text-center">{title}</div>
                {showFilters && (
                    <OrderHistoryFilters
                        selectedSince={selectedSince}
                        onSinceChanged={setSelectedSince}
                        isHomepageOnly={isHomepageOnly}
                        onHomepageOnlyChanged={setIsHomepageOnly}
                        hasHomepageViews={hasHomepageViews}
                    />
                )}
                {showHistoryLink && (
                    <div className="centered-content">
                        <Link to="/order/history" className="default-container default-button">
                            View Full History
                        </Link>
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