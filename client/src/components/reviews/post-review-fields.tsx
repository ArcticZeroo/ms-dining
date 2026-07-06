import React from 'react';
import type { IPostReviewInputViewModel } from '../../hooks/post-review-input.ts';
import { StarRating } from './star-rating.tsx';

interface IPostReviewFieldsProps {
    reviewInput: IPostReviewInputViewModel;
}

export const PostReviewFields: React.FC<IPostReviewFieldsProps> = ({ reviewInput }) => {
    return (
        <>
            {
                reviewInput.postedDateDisplay != null && (
                    <div className="subtitle">
                        Posted on {reviewInput.postedDateDisplay}
                    </div>
                )
            }
            <StarRating
                value={reviewInput.stars}
                disabled={reviewInput.isCurrentlyMakingRequest}
                size="large"
                onChange={reviewInput.onRatingInputChanged}
            />
            <textarea
                id="review-comment"
                className="self-stretch"
                disabled={reviewInput.isCurrentlyMakingRequest}
                placeholder="Comments (optional)"
                value={reviewInput.activeComment}
                onChange={reviewInput.onCommentInputChanged}
                onKeyDown={reviewInput.onCommentInputKeyDown}
                rows={5}
            />
        </>
    );
};
