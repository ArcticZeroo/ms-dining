import React from 'react';
import { IMenuItem } from '../../../../models/cafe.ts';
import { MenuItemImage } from './menu-item-image.tsx';
import { ApplicationSettings } from '../../../../api/settings.ts';
import { useValueNotifier } from '../../../../hooks/events.ts';

export interface IMenuItemProps {
    menuItem: IMenuItem;
}

const getCaloriesDisplay = (menuItem: IMenuItem) => {
    if (!menuItem.calories) {
        return false;
    }

    const parts = [menuItem.calories];
    if (menuItem.maxCalories) {
        parts.push(menuItem.maxCalories);
    }

    return `${parts.join('-')} Calories`;
};

export const MenuItem: React.FC<IMenuItemProps> = ({ menuItem }) => {
    const showImages = useValueNotifier(ApplicationSettings.showImages);
    const showCalories = useValueNotifier(ApplicationSettings.showCalories);
    const showDescriptions = useValueNotifier(ApplicationSettings.showDescriptions);
    const caloriesDisplay = getCaloriesDisplay(menuItem);

    const canShowImage = showImages && (menuItem.hasThumbnail || menuItem.imageUrl != null);

    return (
        <tr>
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