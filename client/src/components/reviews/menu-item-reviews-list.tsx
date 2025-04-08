import { IReviewDataForMenuItem } from '@msdining/common/dist/models/review';
import React from 'react';
import { Link } from 'react-router-dom';
import { useIsLoggedIn } from '../../hooks/auth.ts';
import { MenuItemReview } from './menu-item-review.tsx';

interface IMenuItemReviewsListProps {
    reviewData: IReviewDataForMenuItem;
}

export const MenuItemReviewsList: React.FC<IMenuItemReviewsListProps> = ({ reviewData }) => {
    const isLoggedIn = useIsLoggedIn();

    if (reviewData.totalCount === 0) {
        return (
            <div className="flex flex-center flex-col">
                <span>There are no reviews yet for this item. Be the first!</span>
                {
                    !isLoggedIn && (
                        <Link to="/login" className="default-button default-container">
                            Log in to leave a review
                        </Link>
                    )
                }
            </div>
        );
    }

    return (
        <>
            {
                reviewData.reviewsWithComments.map(review => (
                    <MenuItemReview
                        key={review.id}
                        review={review}
                    />
                ))
            }
        </>
    );
}