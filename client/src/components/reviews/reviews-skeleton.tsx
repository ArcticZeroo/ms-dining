import React from 'react';
import type { IReview } from '@msdining/common/models/review';
import { toDateString } from '@msdining/common/util/date-util';
import { useIsLoggedIn } from '../../hooks/auth.ts';
import { LogInForReviewButton } from './log-in-for-review-button.tsx';
import { ReviewCard } from './review-card.tsx';
import { ReviewFormSkeleton } from './review-form-skeleton.tsx';
import { ReviewStatsSkeleton } from './review-stats-skeleton.tsx';

const SKELETON_REVIEWS: IReview[] = [0, 1].map(index => ({
    id:              `loading-${index}`,
    userDisplayName: '...',
    cafeId:          '',
    rating:          5,
    createdDate:     toDateString(new Date()),
}));

/**
 * Mirrors ReviewsViewWithData so the reviews section reserves its final size
 * while data loads, avoiding a large layout shift when it arrives. Every control
 * is disabled and shows no real data; the loading-skeleton animation fades it.
 */
export const ReviewsSkeleton: React.FC = () => {
    const isLoggedIn = useIsLoggedIn();

    return (
        <div className="reviews flex loading-skeleton" aria-hidden={true}>
            <div className="flex-col">
                {isLoggedIn && <ReviewFormSkeleton/>}
                <LogInForReviewButton/>
                <ReviewStatsSkeleton/>
            </div>
            <div className="flex flex-wrap">
                {
                    SKELETON_REVIEWS.map(review => (
                        <ReviewCard
                            key={review.id}
                            review={review}
                            isSkeleton={true}
                            showMyself={true}
                            showCommentInline={false}
                        />
                    ))
                }
            </div>
        </div>
    );
};
