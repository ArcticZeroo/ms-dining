import { IMenuItem } from '@msdining/common/models/cafe';
import { getIsRecentlyAvailable } from '@msdining/common/util/date-util';
import React, { useMemo } from 'react';
import { ApplicationSettings } from '../../../../constants/settings.ts';
import { useValueNotifier } from '../../../../hooks/events.ts';
import { useMenuItemOrderCount } from '../../../../store/queries/ordering.ts';
import { formatOrderCount } from '../../../../util/order.ts';
import { formatReviewScore } from '../../../../util/reviews.js';
import { MenuItemTags } from './menu-item-tags.tsx';

interface IMenuItemStatsProps {
    menuItem: IMenuItem;
}

export const MenuItemStats: React.FC<IMenuItemStatsProps> = ({ menuItem }) => {
    const showTags = useValueNotifier(ApplicationSettings.showTags);
    const showReviews = useValueNotifier(ApplicationSettings.showReviews);

    const isRecentlyOpened = useMemo(
        () => getIsRecentlyAvailable(menuItem.firstAppearance),
        [menuItem.firstAppearance]
    );

    const orderCount = useMenuItemOrderCount(menuItem.entityKey);
    const orderCountDisplay = formatOrderCount(orderCount);

    return (
        <>
            {
                isRecentlyOpened && (
                    <div className="default-container flex flex-center recently-opened-notice">
                        New to this cafe!
                    </div>
                )
            }
            {
                showTags && (
                    <MenuItemTags tags={menuItem.tags}/>
                )
            }
            {
                showReviews && menuItem.totalReviewCount > 0 && (
                    <span>
                        {formatReviewScore(menuItem.overallRating, menuItem.totalReviewCount)}
                    </span>
                )
            }
            {
                orderCountDisplay && (
                    <span>
                        {orderCountDisplay}
                    </span>
                )
            }
        </>
    );
};
