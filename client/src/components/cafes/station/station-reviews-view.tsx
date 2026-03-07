import React from 'react';
import { MenuItemReviewsLoadingView } from '../../reviews/menu-item-review-loading-view.tsx';
import { REVIEW_STORE } from '../../../store/reviews.ts';
import { useValueNotifier } from '../../../hooks/events.ts';

import '../../reviews/reviews.css';

interface IStationReviewsViewProps {
    stationId: string;
    stationName: string;
    cafeId: string;
}

export const StationReviewsView: React.FC<IStationReviewsViewProps> = ({ stationId, stationName, cafeId }) => {
    const { stage, value, run } = useValueNotifier(REVIEW_STORE.getStationReviews(stationId));

    return (
        <div className="default-container bg-raised-3 flex-col">
            <div className="title">
                Station Reviews
            </div>
            <MenuItemReviewsLoadingView
                stage={stage}
                response={value}
                onRetry={run}
                stationId={stationId}
                stationName={stationName}
                cafeId={cafeId}
            />
        </div>
    );
};
