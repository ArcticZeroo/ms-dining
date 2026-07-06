import { CompletedOrderItemsTable } from '../status/completed-order-items-table.js';
import type { ICafeOrder, ICafeOrderItem } from '@msdining/common/models/order';
import React from 'react';
import { CompletedOrderCardActions } from './completed-order-card-actions.js';
import { CompletedOrderCardHeader } from './completed-order-card-header.js';

interface ICompletedOrderCardProps {
    order: ICafeOrder;
    isPending: boolean;
    reorder: (items: ICafeOrderItem[], navigateAfterAdd?: boolean) => void;
}

export const CompletedOrderCard: React.FC<ICompletedOrderCardProps> = ({
    order,
    isPending,
    reorder,
}) => {
    return (
        <div className="card bg-raised-2">
            <CompletedOrderCardHeader order={order}/>
            <div className="card">
                <CompletedOrderItemsTable
                    items={order.items}
                    subtotal={order.subtotal}
                    tax={order.tax}
                    total={order.total}
                    orderCompletedAt={order.completedAt}
                    showReviewRow={true}
                />
            </div>
            <CompletedOrderCardActions
                items={order.items}
                isPending={isPending}
                reorder={reorder}
            />
        </div>
    );
};