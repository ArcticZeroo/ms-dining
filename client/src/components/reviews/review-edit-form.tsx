import React, { useCallback, useMemo, useState } from 'react';
import { IReview } from '@msdining/common/models/review';
import { REVIEW_MAX_COMMENT_LENGTH_CHARS } from '@msdining/common/models/http';
import { StarRating } from './star-rating.tsx';
import { useDelayedPromiseState, PromiseStage } from '@arcticzeroo/react-promise-hook';
import { classNames } from '../../util/react.ts';
import { REVIEW_STORE } from '../../store/reviews.ts';
import { IReviewLookup } from '../../models/reviews.ts';

interface IReviewEditFormProps {
    review: IReview;
    onSaved: () => void;
    onCancelled: () => void;
    stretchSelf?: boolean;
}

export const ReviewEditForm: React.FC<IReviewEditFormProps> = ({
    review,
    onSaved,
    onCancelled,
    stretchSelf = false
}) => {
    const [editRating, setEditRating] = useState(review.rating);
    const [editComment, setEditComment] = useState(review.comment ?? '');
    const [editDisplayName, setEditDisplayName] = useState(review.userDisplayName);

    const lookup: IReviewLookup = useMemo(() => {
        if (review.stationId) {
            return { stationId: review.stationId, stationName: review.stationName ?? '' };
        }
        return { menuItemId: review.menuItemId ?? '', menuItemName: review.menuItemName ?? '' };
    }, [review.stationId, review.stationName, review.menuItemId, review.menuItemName]);

    const { actualStage: saveStage, run: saveReview } = useDelayedPromiseState(
        useCallback(
            async () => {
                await REVIEW_STORE.updateReview(review.id, lookup, {
                    rating:      editRating,
                    comment:     editComment.trim() || undefined,
                    displayName: !review.userId ? editDisplayName.trim() || undefined : undefined,
                });
                onSaved();
            },
            [review.id, review.userId, lookup, editRating, editComment, editDisplayName, onSaved]
        )
    );

    const isSaving = saveStage === PromiseStage.running;

    const onCancelClicked = (event: React.MouseEvent) => {
        event.preventDefault();
        onCancelled();
    };

    const onSaveClicked = (event: React.MouseEvent) => {
        event.preventDefault();
        if (!isSaving) {
            saveReview();
        }
    };

    return (
        <div className={classNames('flex-col card', stretchSelf && 'self-stretch')}
            onClick={event => event.preventDefault()}>
            <div className="bold">
                Editing review by {review.userDisplayName}
            </div>
            {
                !review.userId && (
                    <input
                        type="text"
                        placeholder="Display name (Anonymous)"
                        value={editDisplayName}
                        onChange={event => setEditDisplayName(event.target.value)}
                        disabled={isSaving}
                    />
                )
            }
            <StarRating
                value={editRating / 2}
                disabled={isSaving}
                size="large"
                onChange={value => {
                    if (value != null) {
                        setEditRating(value * 2);
                    }
                }}
            />
            <textarea
                placeholder="Comment (optional)"
                value={editComment}
                onChange={event => {
                    if (event.target.value.length <= REVIEW_MAX_COMMENT_LENGTH_CHARS) {
                        setEditComment(event.target.value);
                    }
                }}
                disabled={isSaving}
                rows={3}
            />
            <div className="flex">
                <button
                    className="default-button default-container icon-container"
                    onClick={onCancelClicked}
                    title="Cancel editing"
                    disabled={isSaving}
                >
                    <span className="material-symbols-outlined">close</span>
                </button>
                <button
                    className="default-button default-container icon-container"
                    onClick={onSaveClicked}
                    title="Save changes"
                    disabled={isSaving || editRating === 0}
                >
                    <span className="material-symbols-outlined">save</span>
                </button>
            </div>
        </div>
    );
};
