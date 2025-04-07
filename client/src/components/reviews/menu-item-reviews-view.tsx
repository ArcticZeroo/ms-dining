import React, { useCallback } from 'react';
import { useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { DiningClient } from '../../api/dining.ts';
import { MenuItemReviewsLoadingList } from './menu-item-review-list.tsx';

interface IMenuItemReviewsViewProps {
    menuItemId: string;
    cafeId?: string;
}

export const MenuItemReviewsView: React.FC<IMenuItemReviewsViewProps> = ({ menuItemId, cafeId }) => {
    const fetchReviews = useCallback(
        () => DiningClient.retrieveReviewsForMenuItem(menuItemId, cafeId),
        [menuItemId, cafeId]
    );

    const state = useImmediatePromiseState(fetchReviews);

    return (
        <div className="card">
            <div className="title">
                Reviews
            </div>
            <MenuItemReviewsLoadingList stage={state.stage} reviews={state.value} onRetry={state.run} />
        </div>
    )
}