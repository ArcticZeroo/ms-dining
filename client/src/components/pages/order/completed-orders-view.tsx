import { useCompletedOrdersTodayQuery } from '../../../store/queries/ordering.ts';
import { getErrorMessage } from '../../../util/mutation.ts';
import { RetryButton } from '../../button/retry-button.tsx';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';
import { CompletedOrdersList } from './status/completed-orders-list.tsx';

export const CompletedOrdersView = () => {
    const ordersQuery = useCompletedOrdersTodayQuery();

    if (ordersQuery.isPending) {
        return (
            <div id="order-checkout" className="flex-col">
                <div className="card flex flex-justify-center">
                    <HourglassLoadingSpinner/>
                    <span>Loading completed orders...</span>
                </div>
            </div>
        );
    }

    if (ordersQuery.isError) {
        return (
            <div id="order-checkout" className="flex-col">
                <div className="card error">
                    {getErrorMessage(ordersQuery.error, 'Failed to load completed orders')}
                </div>
                <div className="order-page-actions">
                    <RetryButton onClick={() => ordersQuery.refetch()}/>
                </div>
            </div>
        );
    }

    return (
        <div id="order-checkout" className="flex-col">
            <div className="card">
                <div className="title text-center">Your Orders Today</div>
                <CompletedOrdersList orders={ordersQuery.data}/>
            </div>
        </div>
    );
};
