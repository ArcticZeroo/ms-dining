import React, { useMemo } from 'react';
import { ReviewsView } from './reviews-view.tsx';
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
    const lookup = useMemo(() => ({ menuItemId, menuItemName }), [menuItemId, menuItemName]);

    return (
        <div className="default-container bg-raised-3 flex-col">
            <div className="title">
                Reviews
            </div>
            <ReviewsView
                stage={stage}
                response={value}
                onRetry={run}
                cafeId={cafeId}
                lookup={lookup}
            />
        </div>
    )
}