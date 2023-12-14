import React, { useContext } from 'react';
import { IMenuItem } from '../../../../models/cafe.ts';
import { MenuItemImage } from './menu-item-image.tsx';
import { ApplicationSettings } from '../../../../api/settings.ts';
import { useValueNotifier } from '../../../../hooks/events.ts';
import { classNames } from '../../../../util/react.ts';
import { PopupContext } from '../../../../context/modal.ts';
import { MenuItemOrderPopup } from './order/menu-item-order-popup.tsx';

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

    return `${parts.join('-')} Calories`;
};

const menuItemModalSymbol = Symbol('menuItem');

export const MenuItem: React.FC<IMenuItemProps> = ({ menuItem }) => {
    const allowOnlineOrdering = useValueNotifier(ApplicationSettings.allowOnlineOrdering);
    const showImages = useValueNotifier(ApplicationSettings.showImages);
    const showCalories = useValueNotifier(ApplicationSettings.showCalories);
    const showDescriptions = useValueNotifier(ApplicationSettings.showDescriptions);
    const caloriesDisplay = getCaloriesDisplay(menuItem);

    const canShowImage = showImages && (menuItem.hasThumbnail || menuItem.imageUrl != null);

    const modalNotifier = useContext(PopupContext);

    const onClick = () => {
        if (!allowOnlineOrdering) {
            return;
        }

        // There's already a modal active.
        if (modalNotifier.value != null) {
            return;
        }

        modalNotifier.value = {
            id: menuItemModalSymbol,
            title: menuItem.name,
            body: <MenuItemOrderPopup menuItem={menuItem} modalSymbol={menuItemModalSymbol}/>,
        }
    }

    const title = allowOnlineOrdering ? 'Click to open online ordering popup' : undefined;

    return (
        <tr className={classNames(allowOnlineOrdering && 'pointer')} onClick={onClick} title={title}>
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
                ${menuItem.price}
            </td>
            {
                showCalories && (
                    <td>
                        {caloriesDisplay}
                    </td>
                )
            }
        </tr>
    );
};