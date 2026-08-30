import React from 'react';
import type { IReviewSummary } from '@msdining/common/models/review';
import { formatReviewScore } from '../../util/reviews.js';

interface IReviewsSummaryLineProps {
    status: 'pending' | 'success' | 'error';
    response: IReviewSummary | undefined;
}

/** One-line review summary shown in the collapsed reviews header. */
export const ReviewsSummaryLine: React.FC<IReviewsSummaryLineProps> = ({ status, response }) => {
    if (status === 'pending') {
        return <span className="subtitle loading-skeleton">Loading reviews...</span>;
    }

    if (status === 'error' || response == null) {
        return <span className="subtitle">Reviews couldn't be loaded</span>;
    }

    if (response.totalCount === 0) {
        return <span className="subtitle">No reviews yet</span>;
    }

    return <span className="subtitle">{formatReviewScore(response.overallRating, response.totalCount)}</span>;
};
