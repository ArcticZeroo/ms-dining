import React, { useEffect, useState } from 'react';
import { Rating } from '@mui/material';
import { DiningClient } from '../../api/dining.ts';
import { PromiseStage } from '@arcticzeroo/react-promise-hook';
import { ICreateReviewRequest, REVIEW_MAX_COMMENT_LENGTH_CHARS } from '@msdining/common/dist/models/http';
import { IReview } from '@msdining/common/dist/models/review';
import { isNullOrEmpty } from '../../util/string.ts';
import { fromDateString } from '@msdining/common/dist/util/date-util';

interface IPostReviewInputProps {
    menuItemId: string;
    existingReview: IReview | undefined;
    rating: number;
    reviewId: string | undefined;
    onRatingChanged(rating: number): void;
    onReviewIdChanged(reviewId: string | undefined): void;
}

export const PostReviewInput: React.FC<IPostReviewInputProps> = ({ menuItemId, existingReview, rating, reviewId, onRatingChanged, onReviewIdChanged }) => {
    const stars = rating / 2;

    const [lastSavedStars, setLastSavedStars] = useState<number>(stars);

    const [comment, setComment] = useState(existingReview?.comment || '');
    const [hasSavedComment, setHasSavedComment] = useState(false);
    const [lastSavedComment, setLastSavedComment] = useState<string | undefined>(undefined);

    const [reviewCreationStage, setReviewCreationStage] = useState<PromiseStage>(PromiseStage.notRun);

    const isCurrentlyMakingRequest = reviewCreationStage === PromiseStage.running;
    const trimmedComment = comment?.trim();
    const canSaveComment = stars !== 0 && isNullOrEmpty(trimmedComment) !== isNullOrEmpty(trimmedComment) && trimmedComment !== lastSavedComment;
    const canDeleteOrClear = !isCurrentlyMakingRequest && (
        reviewId != null
        || (trimmedComment != null && trimmedComment.length > 0)
    );

    const deleteOrClearButtonHoverText = reviewId == null
        ? 'Clear your pending review'
        : 'Delete your review from the server';

    const saveButtonHoverText = canSaveComment
        ? 'Save your comments'
        : (
            stars === 0
                ? 'Rate your experience before saving your comments'
                : ''
        );

    useEffect(() => {
        if (stars === lastSavedStars && !canSaveComment) {
            return;
        }

        const commentToSave = hasSavedComment ? trimmedComment : undefined;

        setReviewCreationStage(PromiseStage.running);

        const request: ICreateReviewRequest = {
            rating:  stars * 2,
            comment: commentToSave
        };

        DiningClient.createReview(menuItemId, request)
            .then(id => {
                onReviewIdChanged(id);
                setReviewCreationStage(PromiseStage.success);
                setLastSavedStars(stars);
                setLastSavedComment(commentToSave);
            })
            .catch(err => {
                console.error('Could not create review:', err);
                setReviewCreationStage(PromiseStage.error);
            });
    }, [stars, hasSavedComment, menuItemId, lastSavedStars, canSaveComment, trimmedComment, onReviewIdChanged]);

    // If a user clicks on the stars, it'll try to set them to null.
    // We don't want to support null as a possible value, stars must exist in a review.
    const onRatingInputChanged = (value: number | null) => {
        if (value == null || isCurrentlyMakingRequest) {
            return;
        }

        onRatingChanged(value * 2);
    };

    const onCommentChanged = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (isCurrentlyMakingRequest) {
            return;
        }

        const newValue = event.target.value;
        if (newValue.length > REVIEW_MAX_COMMENT_LENGTH_CHARS) {
            return;
        }
        setComment(newValue);
    };

    const onDeleteOrClearReview = () => {
        if (isCurrentlyMakingRequest) {
            return;
        }

        if (reviewId == null) {
            setComment('');
            return;
        }

        setReviewCreationStage(PromiseStage.running);
        DiningClient.deleteReview(reviewId)
            .then(() => {
                onRatingChanged(0);
                onReviewIdChanged(undefined);
                setComment('');
                setReviewCreationStage(PromiseStage.notRun);
            })
            .catch(err => {
                console.error('Could not delete review:', err);
                setReviewCreationStage(PromiseStage.error);
            });
    };

    return (
        <div className="flex-col align-center default-container bg-raised-4">
            <div className="flex">
                {
                    existingReview && ('Your review')
                }
                {
                    !existingReview && ('Leave a review! Comments are optional.')
                }
                {
                    existingReview && (
                        <span className="subtitle">
                            Posted {fromDateString(existingReview.createdDate).toLocaleDateString()}
                        </span>
                    )
                }
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
                name="review-comment"
                className="self-stretch"
                disabled={isCurrentlyMakingRequest}
                placeholder="Comments (optional)"
                value={comment}
                onChange={onCommentChanged}
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
                >
                    <span className="material-symbols-outlined">
                        save
                    </span>
                </button>
            </div>
        </div>
    );
};