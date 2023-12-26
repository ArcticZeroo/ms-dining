import { SearchEntityType } from '@msdining/common/dist/models/search';
import React, { useContext, useMemo } from 'react';
import { ApplicationSettings } from '../../../../api/settings.ts';
import { knownTags } from '../../../../constants/tags.tsx';
import { PopupContext } from '../../../../context/modal.ts';
import { useIsFavoriteItem } from '../../../../hooks/cafe.ts';
import { useValueNotifier } from '../../../../hooks/events.ts';
import { IMenuItem } from '../../../../models/cafe.ts';
import { getPriceDisplay } from '../../../../util/cart.ts';
import { classNames } from '../../../../util/react.ts';
import { MenuItemImage } from './menu-item-image.tsx';
import { MenuItemTags } from './menu-item-tags.tsx';
import { MenuItemPopup } from './popup/menu-item-popup.tsx';
import { CurrentCafeContext } from '../../../../context/menu-item.ts';

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

const menuItemModalSymbol = Symbol('menuItem');

export const MenuItem: React.FC<IMenuItemProps> = ({ menuItem }) => {
    const cafe = useContext(CurrentCafeContext);
    const allowOnlineOrdering = useValueNotifier(ApplicationSettings.allowOnlineOrdering);
    const showImages = useValueNotifier(ApplicationSettings.showImages);
    const showCalories = useValueNotifier(ApplicationSettings.showCalories);
    const showDescriptions = useValueNotifier(ApplicationSettings.showDescriptions);
    const showTags = useValueNotifier(ApplicationSettings.showTags);
    const highlightTagNames = useValueNotifier(ApplicationSettings.highlightTagNames);
    const caloriesDisplay = getCaloriesDisplay(menuItem);

    const isFavoriteItem = useIsFavoriteItem(menuItem.name, SearchEntityType.menuItem);

    const modalNotifier = useContext(PopupContext);

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

    const title = allowOnlineOrdering
        ? `Click to open item details (online ordering enabled)`
        : 'Click to open item details';

    return (
        <tr className={classNames('pointer', isFavoriteItem && 'is-favorite')} onClick={onOpenModalClick} title={title}
            style={{ backgroundColor: currentHighlightTag?.color }}>
            <td colSpan={!canShowImage ? 2 : 1}>
                <div className="menu-item-head">
                    <span className="menu-item-name">{menuItem.name}</span>
                    {
                        showDescriptions
                        && menuItem.description
                        && <span className="menu-item-description">{menuItem.description}</span>
                    }
                </div>
            </td>
            {
                canShowImage && (
                    <td className="centered-content">
                        <MenuItemImage menuItem={menuItem}/>
                    </td>
                )
            }
            <td>
                {getPriceDisplay(menuItem.price)}
            </td>
            {
                showCalories && (
                    <td>
                        {caloriesDisplay}
                    </td>
                )
            }
            {
                showTags && (
                    <td>
                        <MenuItemTags tags={menuItem.tags}/>
                    </td>
                )
            }
        </tr>
    );
};