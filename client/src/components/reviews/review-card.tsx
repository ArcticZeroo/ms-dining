import { IReview } from '@msdining/common/models/review';
import React, { useContext, useState } from 'react';
import { ApplicationContext } from '../../context/app.ts';
import { getViewName } from '../../util/cafe.ts';
import { useValueNotifierContext, useValueNotifier } from '../../hooks/events.ts';
import { UserContext } from '../../context/auth.ts';
import { classNames } from '../../util/react.ts';
import { Link } from 'react-router-dom';
import { getSearchAnchorJumpUrl } from '../../util/link.ts';
import { useCafeIdsOnPage } from '../../hooks/cafes-on-page.ts';
import { fromDateString } from '@msdining/common/util/date-util';
import { SearchEntityType } from '@msdining/common/models/search';
import { normalizeName } from '../../util/string.ts';
import { StarRating } from './star-rating.tsx';
import { PromiseStage } from '@arcticzeroo/react-promise-hook';
import { useIsAdmin } from '../../hooks/auth.ts';
import { DebugSettings } from '../../constants/settings.ts';
import { ReviewEditForm } from './review-edit-form.tsx';
import { REVIEW_STORE } from '../../store/reviews.ts';
import { getReviewEntityName, IReviewLookup, isStationReview } from '../../models/reviews.ts';

const getLookupFromReview = (review: IReview): IReviewLookup => {
    if (review.stationId) {
        return { stationId: review.stationId, stationName: review.stationName ?? '' };
    }
    return { menuItemId: review.menuItemId ?? '', menuItemName: review.menuItemName ?? '' };
};

interface IReviewCardProps {
    review: IReview;
    isSkeleton?: boolean;
    showName?: boolean;
    showMyself: boolean;
    stretchSelf?: boolean;
}

export const ReviewCard: React.FC<IReviewCardProps> = ({
    review,
    showMyself,
    showName = true,
    isSkeleton = false,
    stretchSelf = false
}) => {
    const userId = useValueNotifierContext(UserContext)?.id;
    const isAdmin = useIsAdmin();
    const showAdminControls = useValueNotifier(DebugSettings.showAdminReviewControls);
    const isAdminActive = isAdmin && showAdminControls;
    const { viewsById } = useContext(ApplicationContext);
    const cafeIdsOnPage = useCafeIdsOnPage();
    const view = viewsById.get(review.cafeId);
    const [isEditing, setIsEditing] = useState(false);

    const [deleteStage, setDeleteStage] = useState(PromiseStage.notRun);

    if (!isSkeleton && view == null) {
        return null;
    }

    const isMe = userId != null && userId === review.userId;

    if (isMe && !showMyself) {
        return null;
    }

    const canModify = isMe || isAdminActive;

    const lookup = getLookupFromReview(review);
    const isStation = isStationReview(lookup);

    const link = view == null
        ? '#'
        : getSearchAnchorJumpUrl({
            cafeId:     review.cafeId,
            entityType: isStation ? SearchEntityType.station : SearchEntityType.menuItem,
            name:       normalizeName(getReviewEntityName(lookup)),
            view,
            cafeIdsOnPage,
            date:       new Date()
        });

    const onDeleteClicked = (event: React.MouseEvent) => {
        event.preventDefault();

        if (deleteStage === PromiseStage.running) {
            return;
        }

        setDeleteStage(PromiseStage.running);
        REVIEW_STORE.deleteReview(review.id, lookup)
            .then(() => {
                setDeleteStage(PromiseStage.success);
            })
            .catch(err => {
                console.error('failed to delete:', err);
                setDeleteStage(PromiseStage.error);
            });
    };

    const onEditClicked = (event: React.MouseEvent) => {
        event.preventDefault();
        setIsEditing(true);
    };

    if (isEditing) {
        return (
            <ReviewEditForm
                review={review}
                stretchSelf={stretchSelf}
                onSaved={() => {
                    setIsEditing(false);
                }}
                onCancelled={() => setIsEditing(false)}
            />
        );
    }

    return (
        <Link to={link}
            className={classNames('flex-col card no-decoration', isMe && 'dark-blue', stretchSelf && 'self-stretch')}>
            <div className="flex">
                <span>
                    <span className="bold">
                        {review.userDisplayName}
                    </span>
                    {
                        showName && (
                            <span>
                            &nbsp;reviewed {review.menuItemName ?? review.stationName} at&nbsp;
                            </span>
                        )
                    }
                    {
                        view == null && (
                            <span>
                            ...
                            </span>
                        )
                    }
                    {
                        view != null && (
                            <span>
                                {getViewName({ view, showGroupName: true })}
                            </span>
                        )
                    }
                </span>
            </div>
            <div className="flex flex-around">
                <StarRating
                    value={review.rating / 2}
                    readOnly={true}
                />
                <span>
                    {fromDateString(review.createdDate).toLocaleDateString()}
                </span>
            </div>
            {
                review.comment && (
                    <div className="flex">
                        <span className="material-symbols-outlined">
                            comment
                        </span>
                        <span className="comment">
                            {review.comment}
                        </span>
                    </div>
                )
            }
            {
                canModify && (
                    <div className="flex">
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
                            disabled={deleteStage === PromiseStage.running}
                        >
                            <span className="material-symbols-outlined">
                                delete
                            </span>
                        </button>
                    </div>
                )
            }
        </Link>
    );
};