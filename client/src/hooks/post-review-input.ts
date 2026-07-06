import { REVIEW_MAX_COMMENT_LENGTH_CHARS } from '@msdining/common/models/http';
import type { ICreateReviewRequest } from '@msdining/common/models/http';
import type { IReview } from '@msdining/common/models/review';
import { fromDateString } from '@msdining/common/util/date-util';
import type React from 'react';
import { useState } from 'react';
import { DebugSettings } from '../constants/settings.ts';
import { UserContext } from '../context/auth.ts';
import type { IReviewLookup, IReviewLookupForStation } from '../models/reviews.ts';
import { useCreateReview, useDeleteReview } from '../store/queries/reviews.ts';
import { useIsAdmin } from './auth.ts';
import { useValueNotifier, useValueNotifierContext } from './events.ts';

export interface IPostReviewInputProps {
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

export interface IPostReviewInputViewModel {
    showStationReviewOption: boolean;
    isStationReview: boolean;
    showExistingStationReviewShortcut: boolean;
    showAnonymousOption: boolean;
    isAnonymous: boolean;
    displayName: string;
    isCurrentlyMakingRequest: boolean;
    postedDateDisplay?: string;
    stars: number;
    activeComment: string;
    isDeleteOrClearButtonVisible: boolean;
    canDeleteOrClear: boolean;
    deleteOrClearButtonHoverText: string;
    deleteOrClearButtonIcon: string;
    saveButtonHoverText: string;
    isSaveButtonDisabled: boolean;
    saveButtonIcon: string;
    onStationReviewChanged: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onStationReviewShortcutClicked: () => void;
    onAnonymousChanged: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onDisplayNameChanged: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onRatingInputChanged: (value: number | null) => void;
    onCommentInputChanged: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onCommentInputKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    onDeleteOrClearReview: () => void;
    onSaveClicked: () => void;
}

const getSaveButtonHoverText = (canSaveComment: boolean, stars: number): string => {
    if (canSaveComment) {
        return 'Save your comments';
    }

    if (stars === 0) {
        return 'Rate your experience before saving your comments';
    }

    return 'You have nothing to save! Your comment is the same as what\'s on the server.';
};

const getPostedDateDisplay = (reviewPostedDate: string | undefined, isAnonymous: boolean): string | undefined => {
    if (!reviewPostedDate || isAnonymous) {
        return undefined;
    }

    return fromDateString(reviewPostedDate).toLocaleDateString();
};

export const usePostReviewInput = ({
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
}: IPostReviewInputProps): IPostReviewInputViewModel => {
    const user = useValueNotifierContext(UserContext);
    const isAdmin = useIsAdmin();
    const showAdminControls = useValueNotifier(DebugSettings.showAdminReviewControls);
    const showAnonymousOption = isAdmin && showAdminControls;
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [isStationReview, setIsStationReview] = useState(false);
    const [displayName, setDisplayName] = useState('');

    const [stationRating, setStationRating] = useState<number>(myStationReview?.rating ?? 0);
    const [stationComment, setStationComment] = useState<string>(myStationReview?.comment ?? '');
    const [stationReviewId, setStationReviewId] = useState<string | undefined>(myStationReview?.id);
    const [stationLastSavedComment, setStationLastSavedComment] = useState<string>(myStationReview?.comment ?? '');

    const activeLookup = (isStationReview && stationLookup) ? stationLookup : lookup;
    const activeRating = isStationReview ? stationRating : rating;
    const activeComment = isStationReview ? stationComment : comment;
    const activeReviewId = isStationReview ? stationReviewId : reviewId;
    const activeReviewPostedDate = isStationReview ? myStationReview?.createdDate : reviewPostedDate;

    const [menuItemLastSavedComment, setMenuItemLastSavedComment] = useState<string>(comment);
    const lastSavedComment = isStationReview ? stationLastSavedComment : menuItemLastSavedComment;

    const createMutation = useCreateReview();
    const deleteMutation = useDeleteReview();

    const isCurrentlyMakingRequest = createMutation.isPending || deleteMutation.isPending;
    const stars = activeRating / 2;
    const canSaveComment = stars !== 0 && lastSavedComment !== activeComment;
    const canDeleteOrClear = !isCurrentlyMakingRequest && (activeReviewId != null || lastSavedComment.length > 0);
    const canSubmitAnonymous = isAnonymous && stars !== 0;
    const standardSaveButtonHoverText = getSaveButtonHoverText(canSaveComment, stars);

    const setActiveRating = (newRating: number) => {
        if (isStationReview) {
            setStationRating(newRating);
        } else {
            onRatingChanged(newRating);
        }
    };

    const setActiveComment = (newComment: string) => {
        if (isStationReview) {
            setStationComment(newComment);
        } else {
            onCommentChanged(newComment);
        }
    };

    const setActiveReviewId = (newReviewId: string | undefined) => {
        if (isStationReview) {
            setStationReviewId(newReviewId);
        } else {
            onReviewIdChanged(newReviewId);
        }
    };

    const setLastSavedComment = (newComment: string) => {
        if (isStationReview) {
            setStationLastSavedComment(newComment);
        } else {
            setMenuItemLastSavedComment(newComment);
        }
    };

    const postReview = (request: ICreateReviewRequest) => {
        createMutation.mutate(
            {
                lookup:  activeLookup,
                request,
                context: {
                    userId:          user?.id,
                    userDisplayName: user?.displayName ?? 'Anonymous',
                    cafeId,
                },
            },
            {
                onSuccess: (id) => {
                    if (request.anonymous) {
                        setActiveRating(0);
                        setActiveComment('');
                        setLastSavedComment('');
                        setDisplayName('');
                    } else {
                        setActiveReviewId(id);
                        setLastSavedComment(request.comment || '');
                    }
                },
                onError: (err) => {
                    console.error('Could not create review:', err);
                },
            },
        );
    };

    const onRatingInputChanged = (value: number | null) => {
        if (value == null || isCurrentlyMakingRequest) {
            return;
        }

        const newRating = value * 2;
        setActiveRating(newRating);

        if (isAnonymous) {
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

        deleteMutation.mutate(
            { reviewId: activeReviewId, lookup: activeLookup },
            {
                onSuccess: () => {
                    setActiveRating(0);
                    setActiveReviewId(undefined);
                    setActiveComment('');
                    setLastSavedComment('');
                },
                onError: (err) => {
                    console.error('Could not delete review:', err);
                },
            },
        );
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
    };

    return {
        showStationReviewOption:           stationLookup != null,
        isStationReview,
        showExistingStationReviewShortcut: stationLookup != null && !isStationReview && myStationReview != null,
        showAnonymousOption,
        isAnonymous,
        displayName,
        isCurrentlyMakingRequest,
        postedDateDisplay:                 getPostedDateDisplay(activeReviewPostedDate, isAnonymous),
        stars,
        activeComment,
        isDeleteOrClearButtonVisible:      !isAnonymous,
        canDeleteOrClear,
        deleteOrClearButtonHoverText:      activeReviewId == null
            ? 'Clear your pending review'
            : 'Delete your review from the server',
        deleteOrClearButtonIcon:           activeReviewId == null ? 'clear' : 'delete',
        saveButtonHoverText:               isAnonymous
            ? (canSubmitAnonymous ? 'Submit anonymous review' : 'Rate your experience first')
            : standardSaveButtonHoverText,
        isSaveButtonDisabled:              isAnonymous ? !canSubmitAnonymous : !canSaveComment,
        saveButtonIcon:                    isAnonymous ? 'send' : 'save',
        onStationReviewChanged:            event => setIsStationReview(event.target.checked),
        onStationReviewShortcutClicked:    () => setIsStationReview(true),
        onAnonymousChanged:                event => setIsAnonymous(event.target.checked),
        onDisplayNameChanged:              event => setDisplayName(event.target.value),
        onRatingInputChanged,
        onCommentInputChanged,
        onCommentInputKeyDown,
        onDeleteOrClearReview,
        onSaveClicked,
    };
};
