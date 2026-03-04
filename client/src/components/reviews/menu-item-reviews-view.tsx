import React from 'react';
import { MenuItemReviewsLoadingView } from './menu-item-review-loading-view.tsx';
import { REVIEW_STORE } from '../../store/reviews.ts';
import { useValueNotifier } from '../../hooks/events.ts';

import './reviews.css';

interface IMenuItemReviewsViewProps {
    menuItemId: string;
    menuItemName: string;
    cafeId: string;
}

export const MenuItemReviewsView: React.FC<IMenuItemReviewsViewProps> = ({ menuItemId, menuItemName, cafeId }) => {
    const { stage, value, run } = useValueNotifier(REVIEW_STORE.getReviews(menuItemId));

    return (
        <div className="default-container bg-raised-3 flex-col">
            <div className="title">
                Reviews
            </div>
            <MenuItemReviewsLoadingView
                stage={stage}
                response={value}
                onRetry={run}
                menuItemId={menuItemId}
                menuItemName={menuItemName}
                cafeId={cafeId}
            />
        </div>
    )
}