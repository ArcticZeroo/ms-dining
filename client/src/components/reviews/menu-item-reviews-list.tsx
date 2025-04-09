import { IReviewWithComment } from '@msdining/common/dist/models/review';
import React from 'react';
import { MenuItemReview } from './menu-item-review.tsx';

interface IMenuItemReviewsListProps {
    totalCount: number;
    reviewsWithComments: IReviewWithComment[];
}

export const MenuItemReviewsList: React.FC<IMenuItemReviewsListProps> = ({ totalCount, reviewsWithComments }) => {
    if (totalCount === 0) {
        return (
            <div className="flex flex-center flex-col">
                <span>There are no reviews yet for this item. Be the first!</span>
            </div>
        );
    }

    return (
        <>
            {
                reviewsWithComments.map(review => (
                    <MenuItemReview
                        key={review.id}
                        review={review}
                        showMyself={false}
                    />
                ))
            }
        </>
    );
}