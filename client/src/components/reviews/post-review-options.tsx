import React from 'react';
import type { IPostReviewInputViewModel } from '../../hooks/post-review-input.ts';

interface IPostReviewOptionsProps {
    reviewInput: IPostReviewInputViewModel;
}

export const PostReviewOptions: React.FC<IPostReviewOptionsProps> = ({ reviewInput }) => {
    return (
        <>
            {
                reviewInput.showStationReviewOption && (
                    <div className="flex-col align-center" style={{ gap: '0.25rem' }}>
                        <label className="flex align-center" style={{ gap: '0.5rem' }}>
                            <input
                                type="checkbox"
                                checked={reviewInput.isStationReview}
                                onChange={reviewInput.onStationReviewChanged}
                                disabled={reviewInput.isCurrentlyMakingRequest}
                            />
                            Review this station instead
                        </label>
                        {
                            reviewInput.showExistingStationReviewShortcut && (
                                <span
                                    className="subtitle"
                                    style={{ cursor: 'pointer' }}
                                    onClick={reviewInput.onStationReviewShortcutClicked}
                                >
                                    You already have a station review — click to edit
                                </span>
                            )
                        }
                    </div>
                )
            }
            {
                reviewInput.showAnonymousOption && (
                    <label className="flex align-center" style={{ gap: '0.5rem' }}>
                        <input
                            type="checkbox"
                            checked={reviewInput.isAnonymous}
                            onChange={reviewInput.onAnonymousChanged}
                            disabled={reviewInput.isCurrentlyMakingRequest}
                        />
                        Submit as anonymous
                    </label>
                )
            }
            {
                reviewInput.isAnonymous && (
                    <input
                        type="text"
                        className="self-stretch"
                        placeholder="Display name (optional, defaults to Anonymous)"
                        value={reviewInput.displayName}
                        onChange={reviewInput.onDisplayNameChanged}
                        disabled={reviewInput.isCurrentlyMakingRequest}
                    />
                )
            }
        </>
    );
};
