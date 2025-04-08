import React, { useCallback } from 'react';
import { useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { DiningClient } from '../../api/dining.ts';
import { MenuItemReviewsLoadingView } from './menu-item-review-loading-view.tsx';

import './reviews.css';

interface IMenuItemReviewsViewProps {
    menuItemId: string;
    cafeId?: string;
}

export const MenuItemReviewsView: React.FC<IMenuItemReviewsViewProps> = ({ menuItemId }) => {
    const fetchReviews = useCallback(
        () => DiningClient.retrieveReviewsForMenuItem(menuItemId),
        [menuItemId]
    );

    const { stage, value, run } = useImmediatePromiseState(fetchReviews);

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
            />
        </div>
    )
}