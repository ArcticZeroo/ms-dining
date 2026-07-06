import { IReview } from '@msdining/common/models/review';
import React from 'react';

interface IReviewCardCommentProps {
    review: IReview;
    showCommentInline: boolean;
}

export const ReviewCardComment: React.FC<IReviewCardCommentProps> = ({ review, showCommentInline }) => {
    if (!showCommentInline || !review.comment) {
        return null;
    }

    return (
        <div className="flex">
            <span className="material-symbols-outlined">
                comment
            </span>
            <span className="comment">
                {review.comment}
            </span>
        </div>
    );
};
