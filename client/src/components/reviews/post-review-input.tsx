import React, { useCallback, useState } from 'react';
import { Rating } from '@mui/material';
import { DiningClient } from '../../api/dining.ts';
import { PromiseStage } from '@arcticzeroo/react-promise-hook';
import { ICreateReviewRequest, REVIEW_MAX_COMMENT_LENGTH_CHARS } from '@msdining/common/dist/models/http';
import { fromDateString } from '@msdining/common/dist/util/date-util';
import { classNames } from '../../util/react.ts';
import './reviews.css';

interface IPostReviewInputProps {
    menuItemId: string;
    rating: number;
    comment: string;
    reviewId: string | undefined;
    reviewPostedDate?: string;

    onRatingChanged(rating: number): void;

    onCommentChanged(comment: string): void;

    onReviewIdChanged(reviewId: string | undefined): void;
}

export const PostReviewInput: React.FC<IPostReviewInputProps> = ({
    menuItemId,
    comment,
    rating,
    reviewId,
    reviewPostedDate,
    onRatingChanged,
    onReviewIdChanged,
    onCommentChanged
}) => {
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
            DiningClient.createReview(menuItemId, request)
                .then(id => {
                    onReviewIdChanged(id);
                    setReviewCreationStage(PromiseStage.success);
                    setLastSavedComment(request.comment || '');
                })
                .catch(err => {
                    console.error('Could not create review:', err);
                    setReviewCreationStage(PromiseStage.error);
                });
        },
        [menuItemId, onReviewIdChanged]
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
        DiningClient.deleteReview(reviewId)
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
        postReview({ rating, comment });
    };

    const onCommentInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (canSaveComment && event.ctrlKey && event.key === 'Enter') {
            event.preventDefault();
            onSaveClicked();
        }
    }

    const charactersRemaining = REVIEW_MAX_COMMENT_LENGTH_CHARS - comment.length;
    const shouldShowCharacterCounter = charactersRemaining <= 100;

    return (
        <div className="flex-col align-center default-container bg-raised-4">
            <div className="flex">
                Leave a review! Comments are optional.
            </div>
            {
                reviewPostedDate && (
                    <div className="subtitle">
                        Posted on {fromDateString(reviewPostedDate).toLocaleDateString()}
                    </div>
                )
            }
            <Rating
                name="review-rating"
                value={stars}
                disabled={isCurrentlyMakingRequest}
                precision={0.5}
                size="large"
                onChange={(_, newValue) => onRatingInputChanged(newValue)}
            />
            <div className="relative">
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
                <div className={classNames('character-counter invisible-by-default', shouldShowCharacterCounter && 'visible', charactersRemaining < 50 && 'warning')}>
                    {charactersRemaining} characters remaining
                </div>
            </div>
            <div className="flex">
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
                <button
                    className="icon-container default-button default-container"
                    title={saveButtonHoverText}
                    disabled={!canSaveComment}
                    onClick={onSaveClicked}
                >
                    <span className="material-symbols-outlined">
                        save
                    </span>
                </button>
            </div>
        </div>
    );
};