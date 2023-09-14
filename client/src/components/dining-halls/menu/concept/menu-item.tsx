import React, { useContext } from 'react';
import { IDiningHallMenuItem } from '../../../../models/dining-halls.ts';
import { SettingsContext } from '../../../../context/settings.ts';
//import imageSvg from '../../../../assets/image.svg';

export interface IMenuItemProps {
    menuItem: IDiningHallMenuItem;
}

const getCaloriesDisplay = (menuItem: IDiningHallMenuItem) => {
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
    const [{ showImages }] = useContext(SettingsContext);
    const caloriesDisplay = getCaloriesDisplay(menuItem);

    return (
        <tr>
            <td>
                {menuItem.displayName}
            </td>
            <td>
                {
                    showImages && menuItem.imageUrl && (
                        <img src={menuItem.imageUrl} alt="Click to open image" className="menu-item-image"/>
                    )
                }
            </td>
            <td>
                ${menuItem.price}
            </td>
            <td>
                {caloriesDisplay}
            </td>
        </tr>
    );
};