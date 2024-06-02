import { SearchEntityType } from '@msdining/common/dist/models/search';
import { normalizeNameForSearch } from '@msdining/common/dist/util/search-util';
import React, { useContext, useMemo } from 'react';
import { ApplicationSettings } from '../../../../constants/settings.ts';
import { knownTags } from '../../../../constants/tags.tsx';
import { CafeHeaderHeightContext, StationHeaderHeightContext } from '../../../../context/html.ts';
import { CurrentCafeContext } from '../../../../context/menu-item.ts';
import { PopupContext } from '../../../../context/modal.ts';
import { useIsFavoriteItem, useIsOnlineOrderingAllowedForSelectedDate } from '../../../../hooks/cafe.ts';
import { useValueNotifier } from '../../../../hooks/events.ts';
import { IMenuItem } from '../../../../models/cafe.ts';
import { formatPrice } from '../../../../util/cart.ts';
import { getScrollAnchorId } from '../../../../util/link.ts';
import { classNames } from '../../../../util/react.ts';
import { ScrollAnchor } from '../../../button/scroll-anchor.tsx';
import { MenuItemImage } from './menu-item-image.tsx';
import { MenuItemTags } from './menu-item-tags.tsx';
import { MenuItemPopup } from './popup/menu-item-popup.tsx';
import { MenuItemButtons } from './popup/menu-item-buttons.tsx';

export interface IMenuItemProps {
    menuItem: IMenuItem;
}

const getCaloriesDisplay = (menuItem: IMenuItem) => {
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
    const highlightTagNames = useValueNotifier(ApplicationSettings.highlightTagNames);
    const caloriesDisplay = getCaloriesDisplay(menuItem);
    const isFavoriteItem = useIsFavoriteItem(menuItem.name, SearchEntityType.menuItem);
    const modalNotifier = useContext(PopupContext);
    const scrollAnchorMargin = useScrollAnchorMargin();

    const canShowImage = showImages && (menuItem.hasThumbnail || menuItem.imageUrl != null);

    const onOpenModalClick = () => {
        // There's already a modal active.
        if (modalNotifier.value != null) {
            return;
        }

        modalNotifier.value = {
            id:   menuItemModalSymbol,
            body: <MenuItemPopup
                cafeId={cafe.id}
                menuItem={menuItem}
                modalSymbol={menuItemModalSymbol}
            />,
        };
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
        () => getScrollAnchorId({ cafeId: cafe.id, name: normalizedName, entityType: SearchEntityType.menuItem }),
        [cafe.id, normalizedName]
    );

    const title = isOnlineOrderingAllowed
        ? `Click to open item details (online ordering enabled)`
        : 'Click to open item details';

    return (
        <div className={classNames('flex-col menu-item pointer', isFavoriteItem && 'is-favorite')}
            onClick={onOpenModalClick}
            title={title}
            style={{ backgroundColor: currentHighlightTag?.color }}
        >
            <ScrollAnchor id={scrollAnchorId} margin={scrollAnchorMargin}/>
            <div className="menu-item-head">
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
                showTags && (
                    <MenuItemTags tags={menuItem.tags}/>
                )
            }
        </div>
    );
};