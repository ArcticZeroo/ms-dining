import type { ICafeOrderSummary } from '@msdining/common/models/order';
import React, { useContext } from 'react';
import { ApplicationContext } from '../../../context/app.ts';
import { getViewName } from '../../../util/cafe.ts';
import { formatEstimatedReadyTime, formatWaitTime } from '../../../util/order.ts';

interface ICompletedOrdersListProps {
    orders: ICafeOrderSummary[];
}

export const CompletedOrdersList: React.FC<ICompletedOrdersListProps> = ({ orders }) => {
    const { viewsById } = useContext(ApplicationContext);

    if (orders.length === 0) {
        return (
            <div className="card flex-col align-center">
                No orders found for today
            </div>
        );
    }

    return (
        <div className="order-done-list">
            {orders.map((order) => {
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
    );
};