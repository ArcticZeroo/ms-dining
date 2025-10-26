import { IMenuItemBase, IMenuItem } from '@msdining/common/models/cafe';
import { SearchEntityType } from '@msdining/common/models/search';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import React, { useContext, useMemo } from 'react';
import { ApplicationSettings } from '../../../../constants/settings.ts';
import { knownTags } from '../../../../constants/tags.tsx';
import { CafeHeaderHeightContext, StationHeaderHeightContext } from '../../../../context/html.ts';
import { CurrentCafeContext } from '../../../../context/menu-item.ts';
import { useIsFavoriteItem, useIsOnlineOrderingAllowedForSelectedDate } from '../../../../hooks/cafe.ts';
import { useValueNotifier } from '../../../../hooks/events.ts';
import { formatPrice } from '../../../../util/cart.ts';
import { getSearchAnchorId } from '../../../../util/link.ts';
import { classNames } from '../../../../util/react.ts';
import { ScrollAnchor } from '../../../button/scroll-anchor.tsx';
import { MenuItemImage } from './menu-item-image.tsx';
import { MenuItemTags } from './menu-item-tags.tsx';
import { MenuItemPopup } from './popup/menu-item-popup.tsx';
import { MenuItemButtons } from './popup/menu-item-buttons.tsx';
import { usePopupOpener } from '../../../../hooks/popup.ts';
import { pluralize } from '../../../../util/string.ts';
import { getIsRecentlyAvailable } from '@msdining/common/util/date-util';
import { truncateFloat } from '@msdining/common/util/number-util';

export interface IMenuItemProps {
    menuItem: IMenuItem;
}

const getCaloriesDisplay = (menuItem: IMenuItemBase) => {
    if (!menuItem.calories || Number(menuItem.calories) < 1) {
        return false;
    }

    const parts = [menuItem.calories];
    if (menuItem.maxCalories && Number(menuItem.maxCalories) > 0) {
        parts.push(menuItem.maxCalories);
    }

    return `${parts.join(' - ')} Calories`;
};

const useScrollAnchorMargin = () => {
    const cafeHeaderHeight = useContext(CafeHeaderHeightContext);
    const stationHeaderHeight = useContext(StationHeaderHeightContext);

    return useMemo(
        // 1rem of padding vertically on cafe header, plus 1rem from the bottom of the station header
        () => `calc(${cafeHeaderHeight + stationHeaderHeight}px + 1rem)`,
        [cafeHeaderHeight, stationHeaderHeight]
    );
};

const menuItemModalSymbol = Symbol('menuItem');

export const MenuItem: React.FC<IMenuItemProps> = ({ menuItem }) => {
    const cafe = useContext(CurrentCafeContext);
    const isOnlineOrderingAllowed = useIsOnlineOrderingAllowedForSelectedDate();
    const showImages = useValueNotifier(ApplicationSettings.showImages);
    const showCalories = useValueNotifier(ApplicationSettings.showCalories);
    const showDescriptions = useValueNotifier(ApplicationSettings.showDescriptions);
    const showTags = useValueNotifier(ApplicationSettings.showTags);
    const showReviews = useValueNotifier(ApplicationSettings.showReviews);
    const highlightTagNames = useValueNotifier(ApplicationSettings.highlightTagNames);
    const caloriesDisplay = getCaloriesDisplay(menuItem);
    const isFavoriteItem = useIsFavoriteItem(menuItem.name, SearchEntityType.menuItem);
    const scrollAnchorMargin = useScrollAnchorMargin();
    const openModal = usePopupOpener();

    const canShowImage = showImages && (menuItem.hasThumbnail || menuItem.imageUrl != null);

    const onOpenModalClick = () => {
        openModal({
            id:   menuItemModalSymbol,
            body: <MenuItemPopup
                cafeId={cafe.id}
                menuItem={menuItem}
                modalSymbol={menuItemModalSymbol}
            />,
        });
    };

    const currentHighlightTag = useMemo(() => {
        for (const tagName of menuItem.tags) {
            if (highlightTagNames.has(tagName)) {
                return knownTags[tagName];
            }
        }
    }, [highlightTagNames, menuItem.tags]);

    const normalizedName = useMemo(
        () => normalizeNameForSearch(menuItem.name),
        [menuItem.name]
    );

    const scrollAnchorId = useMemo(
        () => getSearchAnchorId({ cafeId: cafe.id, name: normalizedName, entityType: SearchEntityType.menuItem }),
        [cafe.id, normalizedName]
    );

    const title = isOnlineOrderingAllowed
        ? `Click to open item details (online ordering enabled)`
        : 'Click to open item details';

    const isRecentlyOpened = useMemo(
        () => getIsRecentlyAvailable(menuItem.firstAppearance),
        [menuItem.firstAppearance]
    );

    return (
        <div
            className={classNames('flex-col menu-item pointer', isFavoriteItem && 'is-favorite')}
            onClick={onOpenModalClick}
            title={title}
            style={{ backgroundColor: currentHighlightTag?.color }}
        >
            <div className="menu-item-head">
                {/*Scroll anchor is in the head to avoid extra gap*/}
                <ScrollAnchor id={scrollAnchorId} margin={scrollAnchorMargin}/>
                <span className="menu-item-name">{menuItem.name}</span>
                {
                    showDescriptions
                    && menuItem.description
                    && <span className="menu-item-description">{menuItem.description}</span>
                }
            </div>
            <div className="menu-item-buttons">
                <MenuItemButtons
                    cafeId={cafe.id}
                    menuItem={menuItem}
                />
            </div>
            {
                canShowImage && (
                    <div className="centered-content">
                        <MenuItemImage menuItem={menuItem}/>
                    </div>
                )
            }
            <div className="flex">
                <span>
                    {formatPrice(menuItem.price)}
                </span>
                {
                    showCalories && (
                        <span>
                            {caloriesDisplay}
                        </span>
                    )
                }
            </div>
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
                        {truncateFloat(menuItem.overallRating / 2, 2)} ⭐ ({menuItem.totalReviewCount} {pluralize('review', menuItem.totalReviewCount)})
                    </span>
                )
            }
        </div>
    );
};