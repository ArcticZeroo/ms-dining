import { IReview } from '@msdining/common/models/review';
import React from 'react';
import { getReviewedEntityName, useReviewCardViewDisplay } from '../../hooks/review-card.ts';

interface IReviewCardHeaderProps {
    review: IReview;
    showName: boolean;
}

export const ReviewCardHeader: React.FC<IReviewCardHeaderProps> = ({ review, showName }) => {
    const { hasView, viewName } = useReviewCardViewDisplay(review);

    return (
        <div className="flex">
            <span>
                <span className="bold">
                    {review.userDisplayName}
                </span>
                {
                    showName && (
                        <span>
                            &nbsp;reviewed {getReviewedEntityName(review)} at&nbsp;
                        </span>
                    )
                }
                {
                    !hasView && (
                        <span>
                            ...
                        </span>
                    )
                }
                {
                    hasView && (
                        <span>
                            {viewName}
                        </span>
                    )
                }
            </span>
        </div>
    );
};
