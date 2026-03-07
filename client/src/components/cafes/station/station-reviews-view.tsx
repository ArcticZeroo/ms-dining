import React, { useMemo } from 'react';
import { ReviewsView } from '../../reviews/reviews-view.tsx';
import { REVIEW_STORE } from '../../../store/reviews.ts';
import { useValueNotifier } from '../../../hooks/events.ts';

import '../../reviews/reviews.css';

interface IStationReviewsViewProps {
    stationId: string;
    stationName: string;
    cafeId: string;
}

export const StationReviewsView: React.FC<IStationReviewsViewProps> = ({ stationId, stationName, cafeId }) => {
    const lookup = useMemo(() => ({ stationId, stationName }), [stationId, stationName]);
    const { stage, value, run } = useValueNotifier(REVIEW_STORE.getReviews(lookup));

    return (
        <div className="default-container bg-raised-3 flex-col">
            <div className="title">
                Station Reviews
            </div>
            <ReviewsView
                stage={stage}
                response={value}
                onRetry={run}
                cafeId={cafeId}
                lookup={lookup}
            />
        </div>
    );
};
