import { IReview } from '@msdining/common/models/review';
import React from 'react';
import { getReviewCreatedDateDisplay } from '../../hooks/review-card.ts';
import { StarRating } from './star-rating.tsx';

interface IReviewCardMetaProps {
    review: IReview;
}

export const ReviewCardMeta: React.FC<IReviewCardMetaProps> = ({ review }) => {
    return (
        <div className="flex flex-around">
            <StarRating
                value={review.rating / 2}
                readOnly={true}
            />
            <span>
                {getReviewCreatedDateDisplay(review)}
            </span>
        </div>
    );
};
