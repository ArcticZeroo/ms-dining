import React, { useCallback, useState } from 'react';
import { StarRating } from './star-rating.tsx';
import { PromiseStage } from '@arcticzeroo/react-promise-hook';
import { ICreateReviewRequest, REVIEW_MAX_COMMENT_LENGTH_CHARS } from '@msdining/common/models/http';
import { IReview } from '@msdining/common/models/review';
import { fromDateString } from '@msdining/common/util/date-util';
import { useIsAdmin } from '../../hooks/auth.ts';
import { useValueNotifier, useValueNotifierContext } from '../../hooks/events.ts';
import { DebugSettings } from '../../constants/settings.ts';
import { REVIEW_STORE } from '../../store/reviews.ts';
import { UserContext } from '../../context/auth.ts';
import { IReviewLookup, IReviewLookupForStation } from '../../models/reviews.js';

interface IPostReviewInputProps {
    lookup: IReviewLookup;
    stationLookup?: IReviewLookupForStation;
    myStationReview?: IReview;
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
    stationLookup,
    myStationReview,
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
    const [isStationReview, setIsStationReview] = useState(false);
    const [displayName, setDisplayName] = useState('');

    // Station review form state (tracked internally, separate from the parent-managed menu item state)
    const [stationRating, setStationRating] = useState<number>(myStationReview?.rating ?? 0);
    const [stationComment, setStationComment] = useState<string>(myStationReview?.comment ?? '');
    const [stationReviewId, setStationReviewId] = useState<string | undefined>(myStationReview?.id);
    const [stationLastSavedComment, setStationLastSavedComment] = useState<string>(myStationReview?.comment ?? '');

    const activeLookup = (isStationReview && stationLookup) ? stationLookup : lookup;
    const activeRating = isStationReview ? stationRating : rating;
    const activeComment = isStationReview ? stationComment : comment;
    const activeReviewId = isStationReview ? stationReviewId : reviewId;
    const activeReviewPostedDate = isStationReview ? myStationReview?.createdDate : reviewPostedDate;

    const setActiveRating = isStationReview ? setStationRating : onRatingChanged;
    const setActiveComment = isStationReview ? setStationComment : onCommentChanged;
    const setActiveReviewId = isStationReview ? setStationReviewId : onReviewIdChanged;

    const stars = activeRating / 2;

    const [menuItemLastSavedComment, setMenuItemLastSavedComment] = useState<string>(comment);
    const lastSavedComment = isStationReview ? stationLastSavedComment : menuItemLastSavedComment;
    const setLastSavedComment = isStationReview ? setStationLastSavedComment : setMenuItemLastSavedComment;

    const [reviewCreationStage, setReviewCreationStage] = useState<PromiseStage>(PromiseStage.notRun);

    const isCurrentlyMakingRequest = reviewCreationStage === PromiseStage.running;
    const canSaveComment = stars !== 0 && lastSavedComment !== activeComment;
    const canDeleteOrClear = !isCurrentlyMakingRequest && (activeReviewId != null || lastSavedComment.length > 0);

    const deleteOrClearButtonHoverText = activeReviewId == null
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
            REVIEW_STORE.createReview(activeLookup, request, {
                userId:          user?.id,
                userDisplayName: user?.displayName ?? 'Anonymous',
                cafeId,
            })
                .then(id => {
                    if (request.anonymous) {
                        setActiveRating(0);
                        setActiveComment('');
                        setLastSavedComment('');
                        setDisplayName('');
                    } else {
                        setActiveReviewId(id);
                        setLastSavedComment(request.comment || '');
                    }
                    setReviewCreationStage(PromiseStage.success);
                })
                .catch(err => {
                    console.error('Could not create review:', err);
                    setReviewCreationStage(PromiseStage.error);
                });
        },
        [activeLookup, cafeId, user, setActiveRating, setActiveComment, setActiveReviewId, setLastSavedComment]
    );

    // If a user clicks on the stars, it'll try to set them to null.
    // We don't want to support null as a possible value, stars must exist in a review.
    const onRatingInputChanged = (value: number | null) => {
        if (value == null || isCurrentlyMakingRequest) {
            return;
        }

        const newRating = value * 2;
        setActiveRating(newRating);

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

        setActiveComment(newValue);
    };

    const onDeleteOrClearReview = () => {
        if (isCurrentlyMakingRequest) {
            return;
        }

        if (activeReviewId == null) {
            setActiveComment('');
            return;
        }

        setReviewCreationStage(PromiseStage.running);
        REVIEW_STORE.deleteReview(activeReviewId, activeLookup)
            .then(() => {
                setActiveRating(0);
                setActiveReviewId(undefined);
                setActiveComment('');
                setLastSavedComment('');
                setReviewCreationStage(PromiseStage.notRun);
            })
            .catch(err => {
                console.error('Could not delete review:', err);
                setReviewCreationStage(PromiseStage.error);
            });
    };

    const onSaveClicked = () => {
        const request: ICreateReviewRequest = { rating: activeRating, comment: activeComment };
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
                stationLookup != null && (
                    <div className="flex-col align-center" style={{ gap: '0.25rem' }}>
                        <label className="flex align-center" style={{ gap: '0.5rem' }}>
                            <input
                                type="checkbox"
                                checked={isStationReview}
                                onChange={event => setIsStationReview(event.target.checked)}
                                disabled={isCurrentlyMakingRequest}
                            />
                            Review this station instead
                        </label>
                        {
                            !isStationReview && myStationReview != null && (
                                <span className="subtitle" style={{ cursor: 'pointer' }} onClick={() => setIsStationReview(true)}>
                                    You already have a station review — click to edit
                                </span>
                            )
                        }
                    </div>
                )
            }
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
                activeReviewPostedDate && !isAnonymous && (
                    <div className="subtitle">
                        Posted on {fromDateString(activeReviewPostedDate).toLocaleDateString()}
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
                value={activeComment}
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
                                    activeReviewId == null
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