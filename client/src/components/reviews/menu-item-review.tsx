import { IReview } from '@msdining/common/dist/models/review';
import React, { useContext, useState } from 'react';
import { ApplicationContext } from '../../context/app.ts';
import { getViewName } from '../../util/cafe.ts';
import { useValueNotifierContext } from '../../hooks/events.ts';
import { UserIdContext } from '../../context/auth.ts';
import { classNames } from '../../util/react.ts';
import { Link } from 'react-router-dom';
import { getSearchAnchorJumpUrl } from '../../util/link.ts';
import { useCafeIdsOnPage } from '../../hooks/cafes-on-page.ts';
import { fromDateString } from '@msdining/common/dist/util/date-util';
import { SearchEntityType } from '@msdining/common/dist/models/search';
import { normalizeName } from '../../util/string.ts';
import { Rating } from '@mui/material';
import { DiningClient } from '../../api/dining.ts';
import { PromiseStage } from '@arcticzeroo/react-promise-hook';

interface IMenuItemReviewBaseProps {
    review: IReview;
    showMenuItemName?: boolean;
}

interface IMenuItemReviewNoSelfProps extends IMenuItemReviewBaseProps {
    showMyself?: false;
    onDeleted?: undefined;
}

interface IMenuItemReviewYesSelfProps extends IMenuItemReviewBaseProps {
    showMyself: true;
    onDeleted: () => void;
}

export const MenuItemReview: React.FC<IMenuItemReviewYesSelfProps | IMenuItemReviewNoSelfProps> = ({ review, showMenuItemName = true, showMyself = false, onDeleted = () => {} }) => {
    const userId = useValueNotifierContext(UserIdContext);
    const { viewsById } = useContext(ApplicationContext);
    const cafeIdsOnPage = useCafeIdsOnPage();
    const view = viewsById.get(review.cafeId);
    const [deleteStage, setDeleteStage] = useState(PromiseStage.notRun);

    if (view == null) {
        return null;
    }

    const isMe = userId === review.userId;

    if (isMe && !showMyself) {
        return null;
    }

    const link = getSearchAnchorJumpUrl({
        cafeId:     review.cafeId,
        entityType: SearchEntityType.menuItem,
        name:       normalizeName(review.menuItemName),
        view,
        cafeIdsOnPage,
        date:       new Date()
    });

    const onDeleteClicked = () => {
        if (deleteStage === PromiseStage.running) {
            return;
        }

        setDeleteStage(PromiseStage.running);
        DiningClient.deleteReview(review.id)
            .then(() => {
                setDeleteStage(PromiseStage.success);
                onDeleted();
            })
            .catch(err => {
                console.log('failed to delete:', err);
                setDeleteStage(PromiseStage.error);
            });
    }

    return (
        <div className={classNames('flex-col card', isMe && 'dark-blue')}>
            <div className="flex">
                <span>
                    <span className="bold">
                        {review.userDisplayName}
                    </span>
                    {
                        showMenuItemName && (
                            <span>
                            &nbsp;reviewed {review.menuItemName} @&nbsp;
                            </span>
                        )
                    }
                </span>
                <Link to={link} className="review-location">
                    {getViewName({ view, showGroupName: true })}
                </Link>
            </div>
            <div className="flex flex-around">
                <Rating
                    precision={0.5}
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
                        <span>
                            {review.comment}
                        </span>
                    </div>
                )
            }
            {
                isMe && (
                    <div>
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
        </div>
    );
};