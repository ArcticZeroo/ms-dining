import type { ICafeOrder } from '@msdining/common/models/order';
import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { ApplicationContext } from '../../../../context/app.ts';
import { getViewName } from '../../../../util/cafe.ts';
import { getViewMenuUrlDirect } from '../../../../util/link.ts';
import { formatEstimatedReadyTime } from '../../../../util/order.ts';
import { formatTimeToHoursMinutes } from '../../../../util/date.js';
import { useReorder } from '../../../../hooks/reorder.ts';
import { CompletedOrderItemsTable } from './completed-order-items-table.tsx';
import { useServerCartHasAvailableItems } from '../../../../store/zustand/server-cart.js';

interface ICompletedOrdersListProps {
    orders: ICafeOrder[];
}

export const CompletedOrdersList: React.FC<ICompletedOrdersListProps> = ({ orders }) => {
    const { viewsById } = useContext(ApplicationContext);
    const { reorder, isPending } = useReorder();
    const cartAlreadyHasAvailableItems = useServerCartHasAvailableItems();

    if (orders.length === 0) {
        return (
            <div className="card flex-col align-center">
                No orders found for today
            </div>
        );
    }

    const allItems = orders.flatMap(order => order.items);

    return (
        <>
            <div className="centered-content flex-col">
                <div className="flex">
                    <button
                        className="default-container default-button"
                        disabled={isPending}
                        onClick={() => reorder(allItems, false /*navigateAfterAdd*/)}
                    >
                        Add All To Cart
                    </button>
                    <button
                        className="default-container default-button"
                        disabled={isPending}
                        onClick={() => reorder(allItems)}
                    >
                        Reorder All
                    </button>
                </div>
                {
                    cartAlreadyHasAvailableItems && (
                        <span className="subtitle">
                            You already have items in your cart. Reorder will add to your existing cart.
                        </span>
                    )
                }
            </div>
            <div className="flex flex-center flex-wrap">
                {orders.map((order) => {
                    const view = viewsById.get(order.cafeId);
                    const cafeName = view == null ? order.cafeId : getViewName({ view, showGroupName: true });

                    return (
                        <div key={order.id} className="card dark-blue">
                            <div className="title">
                                {
                                    view != null
                                        ? <Link to={getViewMenuUrlDirect(view)}>{cafeName}</Link>
                                        : cafeName
                                }
                            </div>
                            <div>Order #{order.buyOnDemandOrderNumber}</div>
                            <div>Sent to kitchen at {formatTimeToHoursMinutes(order.completedAt)}</div>
                            <div>Estimated ready: {formatEstimatedReadyTime(order.completedAt, order.waitTimeMin, order.waitTimeMax)}</div>
                            <CompletedOrderItemsTable
                                items={order.items}
                                subtotal={order.subtotal}
                                tax={order.tax}
                                total={order.total}
                            />
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
                    );
                })}
            </div>
        </>
    );
};
