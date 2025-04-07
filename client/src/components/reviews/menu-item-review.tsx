import { IReview } from '@msdining/common/dist/models/review';
import React, { useContext } from 'react';
import { ApplicationContext } from '../../context/app.ts';
import { getViewName } from '../../util/cafe.ts';
import { useValueNotifier, useValueNotifierContext } from '../../hooks/events.ts';
import { UserIdContext } from '../../context/auth.ts';
import { classNames } from '../../util/react.ts';
import { Link } from 'react-router-dom';
import { getViewMenuUrl } from '../../util/link.ts';
import { useCafeIdsOnPage } from '../../hooks/cafes-on-page.ts';
import { ApplicationSettings } from '../../constants/settings.ts';

interface IMenuItemReviewProps {
    review: IReview;
}

export const MenuItemReview: React.FC<IMenuItemReviewProps> = ({ review }) => {
    const userId = useValueNotifierContext(UserIdContext);
    const { viewsById } = useContext(ApplicationContext);
    const view = viewsById.get(review.cafeId);
    const cafeIdsOnPage = useCafeIdsOnPage();
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);

    if (!view) {
        return null;
    }

    const isMe = userId === review.userId;

    const link = getViewMenuUrl({ view, viewsById, cafeIdsOnPage, shouldUseGroups });

    return (
        <div className={classNames("flex-col card", isMe && 'blue')}>
            <div>
                <span className="material-symbols-outlined">
                    person
                </span>
                <span>
                    {review.userDisplayName}
                </span>
            </div>
            {
                review.menuItemName != null && (
                    <div>
                        <span className="material-symbols-outlined">
                            restaurant
                        </span>
                        <span>
                            {review.menuItemName}
                        </span>
                    </div>
                )
            }
            <div>
                <span className="material-symbols-outlined">
                    location_on
                </span>
                <Link to={link}>
                    {getViewName({ view, showGroupName: true })}
                </Link>
            </div>
            <div>
                <span className="material-symbols-outlined">
                    calendar_today
                </span>
                <span>
                    {review.createdAt.toLocaleDateString()}
                </span>
            </div>
            <div>
                <span className="material-symbols-outlined">
                    star
                </span>
                <span>
                    {review.rating / 2}
                </span>
            </div>
            {
                review.comment && (
                    <div>
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
}