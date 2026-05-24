import type { ICafeOrder } from '@msdining/common/models/order';
import React from 'react';
import { useReorder } from '../../../../hooks/reorder.ts';
import { useServerCartHasAvailableItems } from '../../../../store/zustand/server-cart.js';
import { pluralize } from '../../../../util/string.js';
import { CompletedOrderItem } from '../completed-order-item.js';

interface ICompletedOrdersListProps {
    orders: ICafeOrder[];
}

export const CompletedOrdersList: React.FC<ICompletedOrdersListProps> = ({ orders }) => {
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
            </div>
            <div className="flex flex-center flex-wrap">
                {orders.map((order) => (
                    <CompletedOrderItem
                        key={order.id}
                        order={order}
                        reorder={reorder}
                        isPending={isPending}
                    />
                ))}
            </div>
        </>
    );
};
