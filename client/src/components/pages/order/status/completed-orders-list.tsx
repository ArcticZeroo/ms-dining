import type { ICafeOrder } from '@msdining/common/models/order';
import React, { useMemo } from 'react';
import { useReorder } from '../../../../hooks/reorder.ts';
import { useServerCartHasAvailableItems } from '../../../../store/zustand/server-cart.js';
import { pluralize } from '../../../../util/string.js';
import { CompletedOrderCard } from '../history/completed-order-card.js';
import { formatPrice } from '../../../../util/cart.js';
import { fromDateString, toDateString } from '@msdining/common/util/date-util';

interface ICompletedOrdersListProps {
    orders: ICafeOrder[];
    showCompoundReorderButtons: boolean;
}

export const CompletedOrdersList: React.FC<ICompletedOrdersListProps> = ({ orders, showCompoundReorderButtons }) => {
    const { reorder, isPending } = useReorder();
    const cartAlreadyHasAvailableItems = useServerCartHasAvailableItems();
    const totalPrice = useMemo(() => orders.reduce((total, order) => total + order.total, 0), [orders]);
    const ordersByDate: Array<[string /*dateString*/, Array<ICafeOrder>]> = useMemo(
        () => {
            const ordersByDateMap = new Map<string, Array<ICafeOrder>>();
            for (const order of orders) {
                const dateString = toDateString(order.completedAt);
                const ordersForDate = ordersByDateMap.get(dateString) ?? [];
                ordersForDate.push(order);
                ordersByDateMap.set(dateString, ordersForDate);
            }
            
            return Array.from(ordersByDateMap.entries());
        },
        [orders]
    );

    if (orders.length === 0) {
        return (
            <div className="card flex-col align-center">
                No orders found
            </div>
        );
    }

    const allItems = orders.flatMap(order => order.items);

    return (
        <>
            {
                showCompoundReorderButtons && (
                    <div className="flex-col flex-center">
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
                )
            }
            <div className="flex flex-center">
                <span>
                    {orders.length} {pluralize('Order', orders.length)}
                </span>
                <span>
                    -
                </span>
                <span>
                    {allItems.length} {pluralize('Total Item', orders.length)}
                </span>
                <span>
                    -
                </span>
                <span>
                    {formatPrice(totalPrice)} Total
                </span>
            </div>
            <div className="flex flex-col">
                {
                    ordersByDate.map(([dateString, ordersForDate]) => (
                        <>
                            <div className="flex-center card">
                                {fromDateString(dateString).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                            </div>
                            <div className="flex flex-center flex-wrap">
                                {ordersForDate.map((order) => (
                                    <CompletedOrderCard
                                        key={order.id}
                                        order={order}
                                        reorder={reorder}
                                        isPending={isPending}
                                    />
                                ))}
                            </div>
                        </>
                    ))
                }
            </div>
        </>
    );
};
