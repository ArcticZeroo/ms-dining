import type { ICafeOrderItem } from '@msdining/common/models/order';
import { MenuItemPopup } from '../../../cafes/station/menu-items/popup/menu-item-popup.tsx';
import { usePopupOpener } from '../../../../hooks/popup.ts';
import { truncateFloat } from '@msdining/common/util/number-util';
import './order-item-review-row.css';

interface IOrderItemReviewRowProps {
    item: ICafeOrderItem;
    columnCount: number;
}

const modalSymbol = Symbol('order-history-review');

const formatReviewSummary = (review: NonNullable<ICafeOrderItem['review']>): string => {
    const score = truncateFloat(review.rating / 2, 2);
    if (review.comment) {
        return `${score} ⭐ — "${review.comment}"`;
    }
    return `${score} ⭐`;
};

export const OrderItemReviewRow: React.FC<IOrderItemReviewRowProps> = ({ item, columnCount }) => {
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

    return (
        <tr>
            <td colSpan={columnCount}>
                {
                    item.review
                        ? (
                            <button className="order-item-review-row pointer" onClick={onOpenClick}
                                title="Click to view or edit your review">
                                <span>{formatReviewSummary(item.review)}</span>
                                <span className="material-symbols-outlined">edit</span>
                            </button>
                        )
                        : (
                            <button className="order-item-review-row leave pointer" onClick={onOpenClick}
                                title="Click to leave a review">
                                <span className="material-symbols-outlined">rate_review</span>
                                <span>Leave a review</span>
                            </button>
                        )
                }
            </td>
        </tr>
    );
};
