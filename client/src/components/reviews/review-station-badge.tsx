import { IReview } from '@msdining/common/models/review';
import React from 'react';
import { useIsReviewStationReview } from '../../hooks/review-card.ts';

interface IReviewStationBadgeProps {
    review: IReview;
}

export const ReviewStationBadge: React.FC<IReviewStationBadgeProps> = ({ review }) => {
    const isStationReview = useIsReviewStationReview(review);

    if (!isStationReview) {
        return null;
    }

    return (
        <span className="station-review-badge">
            Station review
        </span>
    );
};
