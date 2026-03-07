import { IReviewWithComment } from '@msdining/common/models/review';
import React from 'react';
import { ReviewCard } from './review-card.tsx';

interface IReviewsListProps {
    totalCount: number;
    reviewsWithComments: IReviewWithComment[];
    entityId?: string;
    isStation?: boolean;
}

export const ReviewsList: React.FC<IReviewsListProps> = ({ totalCount, reviewsWithComments, entityId, isStation = false }) => {
    if (totalCount === 0) {
        return (
            <div className="flex flex-center flex-col">
                <span>There are no reviews yet for this {isStation ? 'station' : 'item'}. Be the first!</span>
            </div>
        );
    }

    return (
        <>
            {
                reviewsWithComments.map(review => (
                    <ReviewCard
                        key={review.id}
                        review={review}
                        showMyself={(review.menuItemId ?? review.stationId) !== entityId}
                    />
                ))
            }
        </>
    );
}