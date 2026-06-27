import type { ICafeOrderItem } from '@msdining/common/models/order';
import { MenuItemPopup } from '../../../cafes/station/menu-items/popup/menu-item-popup.tsx';
import { usePopupOpener } from '../../../../hooks/popup.ts';
import { truncateFloat } from '@msdining/common/util/number-util';
import React from 'react';

import './order-item-review-row.css';

interface IOrderItemReviewRowProps {
    item: ICafeOrderItem;
    columnCount: number;
    orderCompletedAt: Date;
}

const modalSymbol = Symbol('order-history-review');

const formatReviewSummary = (review: NonNullable<ICafeOrderItem['review']>): string => {
    const score = truncateFloat(review.rating / 2, 2);
    if (review.comment) {
        return `${score} ⭐ - "${review.comment}"`;
    }
    return `${score} ⭐`;
};

export const OrderItemReviewRow: React.FC<IOrderItemReviewRowProps> = ({ item, columnCount, orderCompletedAt }) => {
    const openModal = usePopupOpener();

    const onOpenClick = () => {
        openModal({
            id:   modalSymbol,
            body: <MenuItemPopup
                cafeId={item.menuItem.cafeId}
                menuItem={item.menuItem}
                modalSymbol={modalSymbol}
                stationId={item.menuItem.stationId}
                stationName={item.stationName}
                mode="orderReview"
            />,
        });
    };
    
    const title = item.review 
        ? 'Click to view or edit your review' 
        : 'Click to leave a review';

    return (
        <tr>
            <td colSpan={columnCount}>
                <div className="flex-col">
                    <button
                        className="default-container flex-col pointer order-review-row"
                        onClick={onOpenClick}
                        title={title}
                    >
                        <div className="flex flex-center">
                            {
                                item.review && (
                                    <>
                                        <span>{formatReviewSummary(item.review)}</span>
                                        <span className="material-symbols-outlined">edit</span>
                                    </>
                                )
                            }
                            {
                                !item.review && (
                                    <>
                                        <span className="material-symbols-outlined">rate_review</span>
                                        <span>Leave a review</span>
                                    </>
                                )
                            }
                        </div>
                        {
                            item.review && orderCompletedAt.getTime() > item.review.createdAt.getTime() && (
                                <div className="subtitle">
                                    You wrote this review for an older order, want to update it?
                                </div>
                            )
                        }
                    </button>
                </div>
            </td>
        </tr>
    );
};
