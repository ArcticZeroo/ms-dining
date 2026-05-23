import type { ICafeOrder } from '@msdining/common/models/order';
import React, { useContext } from 'react';
import { ApplicationContext } from '../../../../context/app.ts';
import { getViewName } from '../../../../util/cafe.ts';
import { formatEstimatedReadyTime } from '../../../../util/order.ts';
import { formatTimeToHoursMinutes } from '../../../../util/date.js';
import { CompletedOrderItemsTable } from './completed-order-items-table.tsx';

interface ICompletedOrdersListProps {
    orders: ICafeOrder[];
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
        <div className="flex flex-center flex-wrap">
            {orders.map((order) => {
                const view = viewsById.get(order.cafeId);
                const cafeName = view == null ? order.cafeId : getViewName({ view, showGroupName: true });

                return (
                    <div key={order.id} className="card dark-blue">
                        <div className="title">{cafeName}</div>
                        <div>Order #{order.buyOnDemandOrderNumber}</div>
                        <div>Sent to kitchen at {formatTimeToHoursMinutes(order.completedAt)}</div>
                        <div>Estimated ready: {formatEstimatedReadyTime(order.completedAt, order.waitTimeMin, order.waitTimeMax)}</div>
                        <CompletedOrderItemsTable
                            items={order.items}
                            subtotal={order.subtotal}
                            tax={order.tax}
                            total={order.total}
                        />
                    </div>
                );
            })}
        </div>
    );
};
