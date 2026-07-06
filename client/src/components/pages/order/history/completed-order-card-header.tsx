import { Link } from 'react-router-dom';
import type { ICafeOrder } from '@msdining/common/models/order';
import React from 'react';
import { useCompletedOrderCardHeader } from '../../../../hooks/completed-order-card.js';
import { formatTimeToHoursMinutes } from '../../../../util/date.js';
import { getViewMenuUrlDirect } from '../../../../util/link.js';
import { formatEstimatedReadyTime } from '../../../../util/order.js';

interface ICompletedOrderCardHeaderProps {
    order: ICafeOrder;
}

export const CompletedOrderCardHeader: React.FC<ICompletedOrderCardHeaderProps> = ({ order }) => {
    const { cafeName, isToday, view } = useCompletedOrderCardHeader(order);

    return (
        <>
            <div className="flex flex-between">
                <div className="title">
                    {
                        view != null
                            ? <Link to={getViewMenuUrlDirect(view)}>{cafeName}</Link>
                            : cafeName
                    }
                </div>
                {
                    !isToday && (
                        <div className="text-muted">
                            {formatTimeToHoursMinutes(order.completedAt)}
                        </div>
                    )
                }
                <div>Order #{order.buyOnDemandOrderNumber}</div>
            </div>
            {
                isToday && (
                    <>
                        <div className="text-center">Placed at {formatTimeToHoursMinutes(order.completedAt)}</div>
                        <div className="text-center">Estimated ready: {formatEstimatedReadyTime(order.completedAt, order.waitTimeMin, order.waitTimeMax)}</div>
                    </>
                )
            }
        </>
    );
};
