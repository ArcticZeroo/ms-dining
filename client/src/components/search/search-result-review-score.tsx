import React from 'react';
import { ApplicationSettings } from '../../constants/settings.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { formatReviewScore } from '../../util/reviews.js';

interface ISearchResultReviewScoreProps {
    overallRating?: number;
    totalReviewCount?: number;
}

export const SearchResultReviewScore: React.FC<ISearchResultReviewScoreProps> = ({
    overallRating,
    totalReviewCount,
}) => {
    const showReviews = useValueNotifier(ApplicationSettings.showReviews);

    if (!showReviews || overallRating == null || totalReviewCount == null || totalReviewCount <= 0) {
        return null;
    }

    return (
        <div className="search-result-review-score">
            {formatReviewScore(overallRating, totalReviewCount)}
        </div>
    );
};
