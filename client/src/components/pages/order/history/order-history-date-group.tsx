import { fromDateString } from '@msdining/common/util/date-util';
import { CompletedOrderCard } from './completed-order-card.js';
import type { ICafeOrder, ICafeOrderItem } from '@msdining/common/models/order';
import React, { useMemo } from 'react';
import { pluralize } from '../../../../util/string.js';
import { getTotalCostForOrders } from '../../../../util/order.js';
import { formatPrice } from '../../../../util/cart.js';

interface IOrderHistoryDateGroupProps {
    dateString: string;
    orders: ICafeOrder[];
    reorder: (items: ICafeOrderItem[], navigateAfterAdd?: boolean) => void;
    isPending: boolean;
}

export const OrderHistoryDateGroup: React.FC<IOrderHistoryDateGroupProps> = ({ dateString, orders, reorder, isPending }) => {
    const totalCost = useMemo(() => getTotalCostForOrders(orders), [orders]);

    return (
        <>
            <div className="section-divider">
                <span>
                    {fromDateString(dateString).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                </span>
                <span>
                    {' · '}
                </span>
                <span>
                    {orders.length} {pluralize('Order', orders.length)}
                </span>
                <span>
                    {' · '}
                </span>
                <span>
                    {formatPrice(totalCost)}
                </span>
            </div>
            <div className="flex flex-center flex-wrap">
                {orders.map((order) => (
                    <CompletedOrderCard
                        key={order.id}
                        order={order}
                        reorder={reorder}
                        isPending={isPending}
                    />
                ))}
            </div>
        </>
    );
}