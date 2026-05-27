import { RetryButton } from '../../button/retry-button.tsx';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';
import { ReviewCard } from '../../reviews/review-card.tsx';
import { IReview } from '@msdining/common/models/review';
import { useMemo } from 'react';
import { ReviewStats } from '../../reviews/review-stats.tsx';
import { useMyReviews } from '../../../store/queries/reviews.ts';
import { CollapsibleContainer } from '../../collapsible/collapsible-container.js';
import { CollapsibleHeader } from '../../collapsible/collapsible-header.js';
import { CollapsibleBody } from '../../collapsible/collapsible-body.js';

interface IReviewStats {
    counts: Record<number, number>;
    totalCount: number;
    overallRating: number;
}

const useReviewStats = (reviews: Array<IReview> | undefined): IReviewStats => {
    return useMemo(
        () => {
            if (!reviews) {
                return {
                    counts: {},
                    totalCount: 0,
                    overallRating: 0
                };
            }

            const counts: Record<number, number> = {};
            let totalCount = 0;
            let overallRating = 0;

            for (const review of reviews) {
                counts[review.rating] = (counts[review.rating] ?? 0) + 1;
                totalCount += 1;
                overallRating += review.rating;
            }

            if (totalCount > 0) {
                overallRating /= totalCount;
            }

            return {
                counts,
                totalCount,
                overallRating
            };
        },
        [reviews]
    );
}

export const ProfileReviews = () => {
    const { isError, data: reviews, refetch } = useMyReviews();
    const stats = useReviewStats(reviews);

    if (isError) {
        return (
            <div className="card error">
                <span>
                    Unable to load your reviews!
                </span>
                <RetryButton onClick={() => refetch()}/>
            </div>
        );
    }

    if (reviews == null) {
        return (
            <div className="card">
                <span>
                    Loading your reviews...
                </span>
                <HourglassLoadingSpinner/>
            </div>
        );
    }

    return (
        <div className="card">
            <div className="title">
                Your Reviews
            </div>
            {
                reviews.length === 0 && (
                    <div>
                        You haven't left any reviews yet. Click on any menu item to leave a review.
                    </div>
                )
            }
            {
                reviews.length > 0 && (
                    <ReviewStats
                        overallRating={stats.overallRating}
                        totalCount={stats.totalCount}
                        counts={stats.counts}
                    />
                )
            }
            {
                reviews.length > 0 && (
                    <CollapsibleContainer>
                        <CollapsibleHeader>
                            Show My Reviews
                        </CollapsibleHeader>
                        <CollapsibleBody>
                            <div className="flex-col">
                                {
                                    reviews.map(review => (
                                        <ReviewCard
                                            key={review.id}
                                            review={review}
                                            showMyself={true}
                                        />
                                    ))
                                }
                            </div>
                        </CollapsibleBody>
                    </CollapsibleContainer>
                )
            }
        </div>
    );
};