import { PromiseStage, useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { DiningClient } from '../../../api/dining.ts';
import { RetryButton } from '../../button/retry-button.tsx';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';
import { MenuItemReview } from '../../reviews/menu-item-review.tsx';
import { IReview } from '@msdining/common/dist/models/review';
import { useMemo } from 'react';
import { ReviewStats } from '../../reviews/review-stats.tsx';

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
    const reviews = useImmediatePromiseState(DiningClient.retrieveMyReviews);
    const stats = useReviewStats(reviews.value);

    if (reviews.stage === PromiseStage.error) {
        return (
            <div className="card error">
                <span>
                    Unable to load your reviews!
                </span>
                <RetryButton onClick={reviews.run}/>
            </div>
        );
    }

    if (reviews.value == null) {
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
                reviews.value.length === 0 && (
                    <div>
                        You haven't left any reviews yet. Click on any menu item to leave a review.
                    </div>
                )
            }
            {
                reviews.value.length > 0 && (
                    <ReviewStats
                        overallRating={stats.overallRating}
                        totalCount={stats.totalCount}
                        counts={stats.counts}
                    />
                )
            }
            {
                reviews.value.length > 0 && (
                    <div className="flex-col">
                        {
                            reviews.value.map(review => (
                                <MenuItemReview
                                    key={review.id}
                                    review={review}/>
                            ))
                        }
                    </div>
                )
            }
        </div>
    );
};