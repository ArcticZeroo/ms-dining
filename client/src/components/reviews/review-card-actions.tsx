import { IReview } from '@msdining/common/models/review';
import React from 'react';
import { useReviewCardActions } from '../../hooks/review-card.ts';

interface IReviewCardActionsProps {
    review: IReview;
    onEdit: () => void;
}

export const ReviewCardActions: React.FC<IReviewCardActionsProps> = ({ review, onEdit }) => {
    const { canModify, isDeletePending, onDeleteClicked, onEditClicked } = useReviewCardActions(review, onEdit);

    if (!canModify) {
        return null;
    }

    return (
        <div className="flex flex-center">
            <button
                className="default-button default-container icon-container"
                onClick={onEditClicked}
                title="Edit this review"
            >
                <span className="material-symbols-outlined">
                    edit
                </span>
            </button>
            <button
                className="default-button default-container icon-container"
                onClick={onDeleteClicked}
                title="Delete this review"
                disabled={isDeletePending}
            >
                <span className="material-symbols-outlined">
                    delete
                </span>
            </button>
        </div>
    );
};
