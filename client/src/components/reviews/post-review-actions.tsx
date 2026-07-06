import React from 'react';
import type { IPostReviewInputViewModel } from '../../hooks/post-review-input.ts';

interface IPostReviewActionsProps {
    reviewInput: IPostReviewInputViewModel;
}

export const PostReviewActions: React.FC<IPostReviewActionsProps> = ({ reviewInput }) => {
    return (
        <div className="flex">
            {
                reviewInput.isDeleteOrClearButtonVisible && (
                    <button
                        className="icon-container default-button default-container"
                        title={reviewInput.deleteOrClearButtonHoverText}
                        disabled={!reviewInput.canDeleteOrClear}
                        onClick={reviewInput.onDeleteOrClearReview}
                    >
                        <span className="material-symbols-outlined">
                            {reviewInput.deleteOrClearButtonIcon}
                        </span>
                    </button>
                )
            }
            <button
                className="icon-container default-button default-container"
                title={reviewInput.saveButtonHoverText}
                disabled={reviewInput.isSaveButtonDisabled}
                onClick={reviewInput.onSaveClicked}
            >
                <span className="material-symbols-outlined">
                    {reviewInput.saveButtonIcon}
                </span>
            </button>
        </div>
    );
};
