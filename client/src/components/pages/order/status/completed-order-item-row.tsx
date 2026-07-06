import type { ICafeOrderItem } from '@msdining/common/models/order';
import React from 'react';
import { CartItemDetailCells } from '../cart/cart-item-detail-cells.tsx';
import { OrderItemReviewRow } from '../history/order-item-review-row.tsx';

const REVIEW_COLUMN_COUNT = 3;

interface ICompletedOrderItemRowProps {
    item: ICafeOrderItem;
    orderCompletedAt: Date;
    showReviewRow: boolean;
}

export const CompletedOrderItemRow: React.FC<ICompletedOrderItemRowProps> = ({
    item,
    orderCompletedAt,
    showReviewRow,
}) => {
    return (
        <>
            <tr className="cart-item">
                <CartItemDetailCells item={item}/>
            </tr>
            {
                showReviewRow && (
                    <OrderItemReviewRow
                        item={item}
                        columnCount={REVIEW_COLUMN_COUNT}
                        orderCompletedAt={orderCompletedAt}
                    />
                )
            }
        </>
    );
};
