import { useCallback, useContext, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { OrderHistoryRange } from '../../../../api/ordering.ts';
import { ApplicationSettings } from '../../../../constants/settings.ts';
import { ApplicationContext } from '../../../../context/app.ts';
import { useValueNotifier } from '../../../../hooks/events.ts';
import { usePageData } from '../../../../hooks/location.ts';
import { useOrderHistoryQuery } from '../../../../store/queries/ordering.ts';
import { OrderHistoryFilters } from './order-history-filters.tsx';
import { useExpandedViewIds } from '../../../../hooks/search.js';
import { OrderHistoryBody } from './order-history-body.tsx';
import './order-history-view.css';

interface IOrderHistoryMetadata {
    title: string;
    description: string;
}

type OrderHistoryMetadataMap = Record<OrderHistoryRange, IOrderHistoryMetadata>;

const ORDER_HISTORY_METADATA = {
    today: { title: "Today's Orders", description: 'Completed orders from today.' },
    '7d':  { title: 'Order History (7d)', description: 'Browse your orders from the last 7 days.' },
    '30d': { title: 'Order History (30d)', description: 'Browse your orders from the last 30 days.' },
    all:   { title: 'Order History (All Time)', description: 'Browse your full order history.' },
} satisfies OrderHistoryMetadataMap;

const DEFAULT_HISTORY_RANGE: keyof typeof ORDER_HISTORY_METADATA = '7d';

const getOrderHistoryMetadata = (param: string | null): [keyof typeof ORDER_HISTORY_METADATA, IOrderHistoryMetadata] => {
    const metadata = ORDER_HISTORY_METADATA[param as OrderHistoryRange];
    if (metadata) {
        return [param as OrderHistoryRange, metadata];
    }
    return [DEFAULT_HISTORY_RANGE, ORDER_HISTORY_METADATA[DEFAULT_HISTORY_RANGE]];
}

interface IOrderHistoryRangeState {
    range: OrderHistoryRange;
    onRangeChanged: (newRange: OrderHistoryRange) => void;
}

const useOrderHistoryRange = (): IOrderHistoryRangeState => {
    const [searchParams, setSearchParams] = useSearchParams();
    const sinceQueryParam = searchParams.get('range');
    const [range, metadata] = useMemo(() => getOrderHistoryMetadata(sinceQueryParam), [sinceQueryParam]);

    const onRangeChanged = useCallback((range: OrderHistoryRange) => {
        setSearchParams(current => {
            const next = new URLSearchParams(current);
            next.set('range', range);
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    usePageData(metadata.title, metadata.description);

    return { range, onRangeChanged };
}

const useVisibleOrders = (range: OrderHistoryRange) => {
    const [isHomepageOnly, setIsHomepageOnly] = useState(false);
    const homepageViewIds = useValueNotifier(ApplicationSettings.homepageViews);
    const { viewsById } = useContext(ApplicationContext);
    const historyQuery = useOrderHistoryQuery(range);

    const hasHomepageViews = homepageViewIds.size > 0;
    const expandedHomepageViewIds = useExpandedViewIds(homepageViewIds, viewsById);

    const visibleOrders = useMemo(() => {
        const orders = historyQuery.data ?? [];
        return orders.filter((orderData) => !isHomepageOnly || expandedHomepageViewIds.has(orderData.cafeId));
    }, [historyQuery.data, isHomepageOnly, expandedHomepageViewIds]);

    return {
        historyQuery,
        visibleOrders,
        isHomepageOnly,
        hasHomepageViews,
        setIsHomepageOnly,
    };
}

export const OrderHistoryView = () => {
    const { range, onRangeChanged } = useOrderHistoryRange();
    const { historyQuery, visibleOrders, isHomepageOnly, hasHomepageViews, setIsHomepageOnly } = useVisibleOrders(range);

    return (
        <div id="order-history" className="flex-col">
            <div className="card flex-col">
                <div className="title text-center">Order History</div>
                <OrderHistoryFilters
                    selectedSince={range}
                    onSinceChanged={onRangeChanged}
                    isHomepageOnly={isHomepageOnly}
                    onHomepageOnlyChanged={setIsHomepageOnly}
                    hasHomepageViews={hasHomepageViews}
                />
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