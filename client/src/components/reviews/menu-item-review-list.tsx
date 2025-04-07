import React from 'react';
import { PromiseStage } from '@arcticzeroo/react-promise-hook';
import { IReview } from '@msdining/common/dist/models/review';
import { HourglassLoadingSpinner } from '../icon/hourglass-loading-spinner.tsx';
import { Nullable } from '@msdining/common/dist/models/util';
import { RetryButton } from '../button/retry-button.tsx';
import { MenuItemReview } from './menu-item-review.tsx';
import { useIsLoggedIn } from '../../hooks/auth.ts';
import { Link } from 'react-router-dom';

interface IMenuItemReviewsListProps {
    stage: PromiseStage;
    reviews: Nullable<IReview[]>;
    onRetry: () => void;
}

export const MenuItemReviewsLoadingList: React.FC<IMenuItemReviewsListProps> = ({ stage, reviews, onRetry }) => {
    const isLoggedIn = useIsLoggedIn();

    if ([PromiseStage.notRun, PromiseStage.running].includes(stage)) {
        return (
            <div className="flex flex-center">
                <HourglassLoadingSpinner/>
                Loading reviews...
            </div>
        );
    }

    if (stage === PromiseStage.error || reviews == null) {
        return (
            <div className="flex flex-center">
                <span>Could not load reviews!</span>
                <RetryButton onClick={onRetry}/>
            </div>
        );
    }

    if (reviews.length === 0) {
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
        <div className="flex-col">
            {
                reviews.map(review => (
                    <MenuItemReview
                        key={review.id}
                        review={review}
                    />
                ))
            }
        </div>
    );
};
