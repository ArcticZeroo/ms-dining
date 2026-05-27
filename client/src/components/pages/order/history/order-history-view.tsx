import { useContext, useEffect, useMemo, useState } from 'react';
import type { OrderHistorySince } from '../../../../api/ordering.ts';
import { ApplicationSettings } from '../../../../constants/settings.ts';
import { ApplicationContext } from '../../../../context/app.ts';
import { useValueNotifier } from '../../../../hooks/events.ts';
import { usePageData } from '../../../../hooks/location.ts';
import { useReorder } from '../../../../hooks/reorder.ts';
import { useOrderHistoryQuery } from '../../../../store/queries/ordering.ts';
import { formatPrice } from '../../../../util/cart.ts';
import { getErrorMessage } from '../../../../util/mutation.ts';
import { classNames } from '../../../../util/react.ts';
import { getHomepageCafeIds } from '../../../../util/sorting.ts';
import { pluralize } from '../../../../util/string.ts';
import { RetryButton } from '../../../button/retry-button.tsx';
import { HourglassLoadingSpinner } from '../../../icon/hourglass-loading-spinner.tsx';
import { CompletedOrderItem } from '../completed-order-item.tsx';
import { OrderHistoryFilters } from './order-history-filters.tsx';
import './order-history-view.css';

export const OrderHistoryView = () => {
    const [selectedSince, setSelectedSince] = useState<OrderHistorySince>('30d');
    const [isHomepageOnly, setIsHomepageOnly] = useState(false);
    const homepageViewIds = useValueNotifier(ApplicationSettings.homepageViews);
    const { viewsById } = useContext(ApplicationContext);
    const historyQuery = useOrderHistoryQuery(selectedSince);
    const { reorder, isPending } = useReorder();

    usePageData('Order History', 'Browse your past dining orders.');

    // homepageViewIds is in the dep array to recompute when homepage settings change.
    // getHomepageCafeIds reads it internally from ApplicationSettings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const homepageCafeIds = useMemo(() => getHomepageCafeIds(viewsById), [homepageViewIds, viewsById]);
    const hasHomepageCafes = homepageCafeIds.size > 0;

    useEffect(() => {
        if (!hasHomepageCafes && isHomepageOnly) {
            setIsHomepageOnly(false);
        }
    }, [hasHomepageCafes, isHomepageOnly]);

    const visibleOrders = useMemo(() => {
        const orders = historyQuery.data ?? [];
        const filteredOrders = orders.filter((orderData) => !isHomepageOnly || homepageCafeIds.has(orderData.cafeId));
        return [...filteredOrders].sort((orderA, orderB) => orderB.completedAt.getTime() - orderA.completedAt.getTime());
    }, [historyQuery.data, isHomepageOnly, homepageCafeIds]);

    const totalSpent = useMemo(
        () => visibleOrders.reduce((total, orderData) => total + orderData.total, 0),
        [visibleOrders]
    );

    if (historyQuery.isPending) {
        return (
            <div id="order-history" className="flex-col">
                <div className="card flex flex-justify-center">
                    <HourglassLoadingSpinner/>
                    <span>Loading order history...</span>
                </div>
            </div>
        );
    }

    if (historyQuery.isError) {
        return (
            <div id="order-history" className="flex-col">
                <div className="card error">
                    {getErrorMessage(historyQuery.error, 'Failed to load order history')}
                </div>
                <div className="flex flex-justify-center">
                    <RetryButton onClick={() => historyQuery.refetch()}/>
                </div>
            </div>
        );
    }

    return (
        <div id="order-history" className="flex-col">
            <div className="card flex-col">
                <div className="title text-center">Order History</div>
                <OrderHistoryFilters
                    selectedSince={selectedSince}
                    onSinceChanged={setSelectedSince}
                    isHomepageOnly={isHomepageOnly}
                    onHomepageOnlyChanged={setIsHomepageOnly}
                    hasHomepageCafes={hasHomepageCafes}
                />
                <div className="order-history-summary subtitle text-center">
                    {visibleOrders.length} {pluralize('order', visibleOrders.length)} • {formatPrice(totalSpent)} total
                </div>
            </div>
            {
                visibleOrders.length === 0 && (
                    <div className="card flex flex-center">
                        No orders found
                    </div>
                )
            }
            {
                visibleOrders.length > 0 && (
                    <div className={classNames('order-history-list flex flex-center flex-wrap', historyQuery.isFetching && 'loading-skeleton')}>
                        {visibleOrders.map((orderData) => (
                            <CompletedOrderItem
                                key={orderData.id}
                                order={orderData}
                                reorder={reorder}
                                isPending={isPending}
                            />
                        ))}
                    </div>
                )
            }
        </div>
    );
};
