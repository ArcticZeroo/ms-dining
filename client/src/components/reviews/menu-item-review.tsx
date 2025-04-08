import { IReview } from '@msdining/common/dist/models/review';
import React, { useContext } from 'react';
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
import { Rating } from '@mui/material'

interface IMenuItemReviewProps {
    review: IReview;
    showMenuItemName?: boolean;
}

export const MenuItemReview: React.FC<IMenuItemReviewProps> = ({ review, showMenuItemName = true }) => {
    const userId = useValueNotifierContext(UserIdContext);
    const { viewsById } = useContext(ApplicationContext);
    const cafeIdsOnPage = useCafeIdsOnPage();
    const view = viewsById.get(review.cafeId);

    if (view == null) {
        return null;
    }

    const isMe = userId === review.userId;

    const link = getSearchAnchorJumpUrl({
        cafeId:     review.cafeId,
        entityType: SearchEntityType.menuItem,
        name:       normalizeName(review.menuItemName),
        view,
        cafeIdsOnPage,
        date:       new Date()
    });

    return (
        <div className={classNames('flex-col card', isMe && 'blue')}>
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
                <Link to={link} className="flex">
                    {getViewName({ view, showGroupName: true })}
                </Link>
            </div>
            <div className="flex flex-around">
                <Rating
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
        </div>
    );
};