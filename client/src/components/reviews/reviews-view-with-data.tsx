import { PostReviewInput } from './post-review-input.tsx';
import { ReviewStats } from './review-stats.tsx';
import { ReviewsList } from './reviews-list.tsx';
import { IReviewSummary } from '@msdining/common/models/review';
import React, { useState } from 'react';
import { useIsLoggedIn } from '../../hooks/auth.ts';
import { LogInForReviewButton } from './log-in-for-review-button.tsx';
import { IReviewLookup } from '../../models/reviews.js';

interface IReviewsViewWithDataProps {
    response: IReviewSummary;
    cafeId: string;
    lookup: IReviewLookup;
}

export const ReviewsViewWithData: React.FC<IReviewsViewWithDataProps> = ({ response, cafeId, lookup }) => {
    const [localComment, setLocalComment] = useState<string>(response.myReview?.comment ?? '');
    const [localRating, setLocalRating] = useState<number>(response.myReview?.rating ?? 0);
    const [reviewId, setReviewId] = useState<string | undefined>(response.myReview?.id);
    const isLoggedIn = useIsLoggedIn();

    const entityId = lookup.menuItemId ?? lookup.stationId;

    const reviewInputProps = {
        cafeId,
        comment:           localComment,
        rating:            localRating,
        reviewId,
        reviewPostedDate:  response.myReview?.createdDate,
        onRatingChanged:   setLocalRating,
        onCommentChanged:  setLocalComment,
        onReviewIdChanged: setReviewId,
    };

    return (
        <div className="reviews flex">
            <div className="flex-col">
                {
                    isLoggedIn && (
                        <PostReviewInput
                            {...reviewInputProps}
                            lookup={lookup}
                        />
                    )
                }
                <LogInForReviewButton/>
                <ReviewStats
                    counts={response.counts}
                    totalCount={response.totalCount}
                    overallRating={response.overallRating}
                />
            </div>
            <div className="flex flex-wrap">
                <ReviewsList
                    totalCount={response.totalCount}
                    reviewsWithComments={response.reviewsWithComments}
                    entityId={entityId}
                    isStation={lookup.stationId != null}
                />
            </div>
        </div>
    );
};