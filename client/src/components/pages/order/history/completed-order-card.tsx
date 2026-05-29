import { Link } from 'react-router-dom';
import { getViewMenuUrlDirect } from '../../../../util/link.js';
import { formatTimeToHoursMinutes } from '../../../../util/date.js';
import { formatEstimatedReadyTime } from '../../../../util/order.js';
import { CompletedOrderItemsTable } from '../status/completed-order-items-table.js';
import type { ICafeOrder, ICafeOrderItem } from '@msdining/common/models/order';
import { getViewName } from '../../../../util/cafe.js';
import React, { useContext } from 'react';
import { ApplicationContext } from '../../../../context/app.js';

interface ICompletedOrderItemProps {
    order: ICafeOrder;
    isPending: boolean;
    reorder: (items: ICafeOrderItem[], navigateAfterAdd?: boolean) => void;
}

export const CompletedOrderCard: React.FC<ICompletedOrderItemProps> = ({
    order,
    isPending,
    reorder,
}) => {
    const { viewsById } = useContext(ApplicationContext);
    const view = viewsById.get(order.cafeId);
    const cafeName = view == null ? order.cafeId : getViewName({ view, showGroupName: true });

    return (
        <div className="card bg-raised-2">
            <div className="flex flex-between">
                <div className="title">
                    {
                        view != null
                            ? <Link to={getViewMenuUrlDirect(view)}>{cafeName}</Link>
                            : cafeName
                    }
                </div>
                <div>Order #{order.buyOnDemandOrderNumber}</div>
            </div>
            <div className="text-center">Placed at {formatTimeToHoursMinutes(order.completedAt)}</div>
            <div className="text-center">Estimated ready: {formatEstimatedReadyTime(order.completedAt, order.waitTimeMin, order.waitTimeMax)}</div>
            <div className="card">
                <CompletedOrderItemsTable
                    items={order.items}
                    subtotal={order.subtotal}
                    tax={order.tax}
                    total={order.total}
                />
            </div>
            <div className="flex flex-between">
                <button
                    className="default-container default-button"
                    disabled={isPending}
                    onClick={() => reorder(order.items, false /*navigateAfterAdd*/)}
                >
                    Add Items To Cart
                </button>
                <button
                    className="default-container default-button"
                    disabled={isPending}
                    onClick={() => reorder(order.items)}
                >
                    Reorder
                </button>
            </div>
        </div>
    );
};