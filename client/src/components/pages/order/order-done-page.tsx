import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApplicationContext } from '../../../context/app.ts';
import { useCompletedOrdersTodayQuery } from '../../../store/queries/new-ordering.ts';
import { getViewName } from '../../../util/cafe.ts';
import { getErrorMessage } from '../../../util/mutation.ts';
import { formatEstimatedReadyTime, formatWaitTime } from '../../../util/order.ts';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';

export const OrderDonePage = () => {
    const navigate = useNavigate();
    const { viewsById } = useContext(ApplicationContext);
    const ordersQuery = useCompletedOrdersTodayQuery();

    if (ordersQuery.isPending) {
        return (
            <div id="order-checkout" className="flex-col">
                <div className="flex flex-justify-center">
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
                    {getErrorMessage(ordersQuery.error, 'Failed to load completed orders.')}
                </div>
                <div className="order-page-actions">
                    <button className="default-container" onClick={() => navigate('/')}>
                        Return Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div id="order-checkout" className="flex-col">
            <div className="card dark-blue">
                <div className="title">Today&apos;s Completed Orders</div>
                <div>Review your cafe receipts and estimated ready times below.</div>
            </div>
            {ordersQuery.data.length === 0 ? (
                <div className="card dark-blue">
                    No completed orders were found for today.
                </div>
            ) : (
                <div className="order-done-list">
                    {ordersQuery.data.map((order) => {
                        const view = viewsById.get(order.cafeId);
                        const cafeName = view == null ? order.cafeId : getViewName({ view, showGroupName: true });

                        return (
                            <div key={order.id} className="card dark-blue">
                                <div className="title">{cafeName}</div>
                                <div>Order #{order.buyOnDemandOrderNumber}</div>
                                <div>Estimated wait: {formatWaitTime(order.waitTimeMin, order.waitTimeMax)}</div>
                                <div>Estimated ready: {formatEstimatedReadyTime(order.completedAt, order.waitTimeMin, order.waitTimeMax)}</div>
                            </div>
                        );
                    })}
                </div>
            )}
            <div className="order-page-actions">
                <button className="default-container" onClick={() => navigate('/')}>
                    Return Home
                </button>
            </div>
        </div>
    );
};
