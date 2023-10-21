import React, { useContext } from 'react';
import { IMenuItem } from '../../../../models/cafe.ts';
import { SettingsContext } from '../../../../context/settings.ts';
import { MenuItemImage } from './menu-item-image.tsx';

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
    const [{ showImages, showCalories, showDescriptions }] = useContext(SettingsContext);
    const caloriesDisplay = getCaloriesDisplay(menuItem);

    const canShowImage = showImages && (menuItem.hasThumbnail || menuItem.imageUrl != null);

    return (
        <tr>
            <td colSpan={!canShowImage ? 2 : 1}>
                <div className="menu-item-head">
                    <span className="menu-item-name">{menuItem.displayName}</span>
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