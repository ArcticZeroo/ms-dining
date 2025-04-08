import React, { useCallback, useState } from 'react';
import { Rating } from '@mui/material';
import { DiningClient } from '../../api/dining.ts';
import { PromiseStage } from '@arcticzeroo/react-promise-hook';
import { ICreateReviewRequest, REVIEW_MAX_COMMENT_LENGTH_CHARS } from '@msdining/common/dist/models/http';

interface IPostReviewInputProps {
    menuItemId: string;
    rating: number;
    comment: string;
    reviewId: string | undefined;

    onRatingChanged(rating: number): void;

    onCommentChanged(comment: string): void;

    onReviewIdChanged(reviewId: string | undefined): void;
}

export const PostReviewInput: React.FC<IPostReviewInputProps> = ({
    menuItemId,
    comment,
    rating,
    reviewId,
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
        [menuItemId, onReviewIdChanged, onCommentChanged, onRatingChanged]
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

    return (
        <div className="flex-col align-center default-container bg-raised-4">
            <div className="flex">
                {/*{*/}
                {/*    existingReview && ('Your review')*/}
                {/*}*/}
                {/*{*/}
                {/*    !existingReview && ('Leave a review! Comments are optional.')*/}
                {/*}*/}
                {/*{*/}
                {/*    existingReview && (*/}
                {/*        <span className="subtitle">*/}
                {/*            Posted {fromDateString(existingReview.createdDate).toLocaleDateString()}*/}
                {/*        </span>*/}
                {/*    )*/}
                {/*}*/}
                Leave a review! Comments are optional.
            </div>
            <Rating
                name="review-rating"
                value={stars}
                disabled={isCurrentlyMakingRequest}
                precision={0.5}
                size="large"
                onChange={(_, newValue) => onRatingInputChanged(newValue)}
            />
            <textarea
                id="review-comment"
                className="self-stretch"
                disabled={isCurrentlyMakingRequest}
                placeholder="Comments (optional)"
                value={comment}
                onChange={onCommentInputChanged}
            />
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