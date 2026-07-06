import type { ICafeOrderItem } from '@msdining/common/models/order';
import React from 'react';

interface ICompletedOrderCardActionsProps {
    items: ICafeOrderItem[];
    isPending: boolean;
    reorder: (items: ICafeOrderItem[], navigateAfterAdd?: boolean) => void;
}

export const CompletedOrderCardActions: React.FC<ICompletedOrderCardActionsProps> = ({
    items,
    isPending,
    reorder,
}) => {
    const onAddItemsToCartClick = () => {
        reorder(items, false /*navigateAfterAdd*/);
    };

    const onReorderClick = () => {
        reorder(items);
    };

    return (
        <div className="flex flex-between">
            <button
                className="default-container default-button"
                disabled={isPending}
                onClick={onAddItemsToCartClick}
            >
                Add Items To Cart
            </button>
            <button
                className="default-container default-button"
                disabled={isPending}
                onClick={onReorderClick}
            >
                Reorder
            </button>
        </div>
    );
};
