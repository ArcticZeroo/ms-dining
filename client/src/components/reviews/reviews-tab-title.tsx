import React from 'react';
import { formatReviewScore } from '../../util/reviews.js';
import { useReviewSummary } from '../../store/queries/reviews.ts';
import { IReviewLookup } from '../../models/reviews.js';

interface IReviewsTabTitleProps {
    lookup: IReviewLookup;
}

/**
 * Tab label for the reviews tab: "Reviews" plus a compact score/count summary.
 * Owns the review-summary query so its loading only re-renders the label.
 */
export const ReviewsTabTitle: React.FC<IReviewsTabTitleProps> = ({ lookup }) => {
    const { status, data } = useReviewSummary(lookup);

    let summary: React.ReactNode = null;

    if (status === 'pending') {
        summary = <span className="subtitle loading-skeleton">Loading...</span>;
    } else if (data != null && data.totalCount > 0) {
        summary = <span className="subtitle">{formatReviewScore(data.overallRating, data.totalCount)}</span>;
    }
    // intentionally not handling the "no reviews yet" case, would prefer the user gets curious and leaves a review

    return (
        <span className="flex align-center constant-gap">
            Reviews
            {summary}
        </span>
    );
};
