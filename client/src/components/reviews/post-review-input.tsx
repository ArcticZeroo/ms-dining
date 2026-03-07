import React, { useCallback, useState } from 'react';
import { StarRating } from './star-rating.tsx';
import { PromiseStage } from '@arcticzeroo/react-promise-hook';
import { ICreateReviewRequest, REVIEW_MAX_COMMENT_LENGTH_CHARS } from '@msdining/common/models/http';
import { fromDateString } from '@msdining/common/util/date-util';
import { useIsAdmin } from '../../hooks/auth.ts';
import { useValueNotifier, useValueNotifierContext } from '../../hooks/events.ts';
import { DebugSettings } from '../../constants/settings.ts';
import { REVIEW_STORE } from '../../store/reviews.ts';
import { UserContext } from '../../context/auth.ts';
import { IReviewLookup } from '../../models/reviews.js';

interface IPostReviewInputProps {
    lookup: IReviewLookup;
    cafeId: string;
    rating: number;
    comment: string;
    reviewId: string | undefined;
    reviewPostedDate?: string;

    onRatingChanged(rating: number): void;

    onCommentChanged(comment: string): void;

    onReviewIdChanged(reviewId: string | undefined): void;
}

export const PostReviewInput: React.FC<IPostReviewInputProps> = ({
    lookup,
    cafeId,
    comment,
    rating,
    reviewId,
    reviewPostedDate,
    onRatingChanged,
    onReviewIdChanged,
    onCommentChanged,
}) => {
    const user = useValueNotifierContext(UserContext);
    const isAdmin = useIsAdmin();
    const showAdminControls = useValueNotifier(DebugSettings.showAdminReviewControls);
    const showAnonymousOption = isAdmin && showAdminControls;
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [displayName, setDisplayName] = useState('');

    const stars = rating / 2;

    const [lastSavedComment, setLastSavedComment] = useState<string>(comment);

    const [reviewCreationStage, setReviewCreationStage] = useState<PromiseStage>(PromiseStage.notRun);

    const isCurrentlyMakingRequest = reviewCreationStage === PromiseStage.running;
    const canSaveComment = stars !== 0 && lastSavedComment !== comment;
    const canDeleteOrClear = !isCurrentlyMakingRequest && (reviewId != null || lastSavedComment.length > 0);

    const deleteOrClearButtonHoverText = reviewId == null
        ? 'Clear your pending review'
        : 'Delete your review from the server';

    const saveButtonHoverText = canSaveComment
        ? 'Save your comments'
        : (
            stars === 0
                ? 'Rate your experience before saving your comments'
                : 'You have nothing to save! Your comment is the same as what\'s on the server.'
        );

    const postReview = useCallback(
        (request: ICreateReviewRequest) => {
            setReviewCreationStage(PromiseStage.running);
            REVIEW_STORE.createReview(lookup, request, {
                userId:          user?.id,
                userDisplayName: user?.displayName ?? 'Anonymous',
                cafeId,
            })
                .then(id => {
                    if (request.anonymous) {
                        onRatingChanged(0);
                        onCommentChanged('');
                        setLastSavedComment('');
                        setDisplayName('');
                    } else {
                        onReviewIdChanged(id);
                        setLastSavedComment(request.comment || '');
                    }
                    setReviewCreationStage(PromiseStage.success);
                })
                .catch(err => {
                    console.error('Could not create review:', err);
                    setReviewCreationStage(PromiseStage.error);
                });
        },
        [lookup, cafeId, user, onReviewIdChanged, onRatingChanged, onCommentChanged]
    );

    // If a user clicks on the stars, it'll try to set them to null.
    // We don't want to support null as a possible value, stars must exist in a review.
    const onRatingInputChanged = (value: number | null) => {
        if (value == null || isCurrentlyMakingRequest) {
            return;
        }

        const newRating = value * 2;
        // Show the new value to the user while we do the update
        onRatingChanged(newRating);

        if (isAnonymous) {
            // In anonymous mode, don't auto-submit on rating change
            return;
        }

        postReview({ rating: newRating, comment: lastSavedComment });
    };

    const onCommentInputChanged = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (isCurrentlyMakingRequest) {
            return;
        }

        const newValue = event.target.value;
        if (newValue.length > REVIEW_MAX_COMMENT_LENGTH_CHARS) {
            return;
        }

        onCommentChanged(newValue);
    };

    const onDeleteOrClearReview = () => {
        if (isCurrentlyMakingRequest) {
            return;
        }

        if (reviewId == null) {
            onCommentChanged('');
            return;
        }

        setReviewCreationStage(PromiseStage.running);
        REVIEW_STORE.deleteReview(reviewId, lookup)
            .then(() => {
                onRatingChanged(0);
                onReviewIdChanged(undefined);
                onCommentChanged('');
                setReviewCreationStage(PromiseStage.notRun);
            })
            .catch(err => {
                console.error('Could not delete review:', err);
                setReviewCreationStage(PromiseStage.error);
            });
    };

    const onSaveClicked = () => {
        const request: ICreateReviewRequest = { rating, comment };
        if (isAnonymous) {
            request.anonymous = true;
            if (displayName.trim().length > 0) {
                request.displayName = displayName.trim();
            }
        }
        postReview(request);
    };

    const onCommentInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (canSaveComment && event.ctrlKey && event.key === 'Enter') {
            event.preventDefault();
            onSaveClicked();
        }
    }

    const canSubmitAnonymous = isAnonymous && stars !== 0;

    return (
        <div className="flex-col align-center default-container bg-raised-4">
            <div className="flex">
                Leave a review! Comments are optional.
            </div>
            {
                showAnonymousOption && (
                    <label className="flex align-center" style={{ gap: '0.5rem' }}>
                        <input
                            type="checkbox"
                            checked={isAnonymous}
                            onChange={event => setIsAnonymous(event.target.checked)}
                            disabled={isCurrentlyMakingRequest}
                        />
                        Submit as anonymous
                    </label>
                )
            }
            {
                isAnonymous && (
                    <input
                        type="text"
                        className="self-stretch"
                        placeholder="Display name (optional, defaults to Anonymous)"
                        value={displayName}
                        onChange={event => setDisplayName(event.target.value)}
                        disabled={isCurrentlyMakingRequest}
                    />
                )
            }
            {
                reviewPostedDate && !isAnonymous && (
                    <div className="subtitle">
                        Posted on {fromDateString(reviewPostedDate).toLocaleDateString()}
                    </div>
                )
            }
            <StarRating
                value={stars}
                disabled={isCurrentlyMakingRequest}
                size="large"
                onChange={(newValue) => onRatingInputChanged(newValue)}
            />
            <textarea
                id="review-comment"
                className="self-stretch"
                disabled={isCurrentlyMakingRequest}
                placeholder="Comments (optional)"
                value={comment}
                onChange={onCommentInputChanged}
                onKeyDown={onCommentInputKeyDown}
                rows={5}
            />
            <div className="flex">
                {
                    !isAnonymous && (
                        <button
                            className="icon-container default-button default-container"
                            title={deleteOrClearButtonHoverText}
                            disabled={!canDeleteOrClear}
                            onClick={onDeleteOrClearReview}
                        >
                            <span className="material-symbols-outlined">
                                {
                                    reviewId == null
                                        ? 'clear'
                                        : 'delete'
                                }
                            </span>
                        </button>
                    )
                }
                <button
                    className="icon-container default-button default-container"
                    title={isAnonymous ? (canSubmitAnonymous ? 'Submit anonymous review' : 'Rate your experience first') : saveButtonHoverText}
                    disabled={isAnonymous ? !canSubmitAnonymous : !canSaveComment}
                    onClick={onSaveClicked}
                >
                    <span className="material-symbols-outlined">
                        {isAnonymous ? 'send' : 'save'}
                    </span>
                </button>
            </div>
        </div>
    );
};