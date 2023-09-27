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
    const [{ showImages, showCalories }] = useContext(SettingsContext);
    const caloriesDisplay = getCaloriesDisplay(menuItem);

    return (
        <tr>
            <td>
                {menuItem.displayName}
            </td>
            {
                // Always show this <td> when images are enabled, even if there is no image url, in order to keep the same column count across rows
                showImages && (
                    <td className="centered-content">
                        {
                            menuItem.imageUrl && (
                                <img src={menuItem.imageUrl}
                                     decoding="async"
                                     alt="Menu item image"
                                     className="menu-item-image"
                                     loading="lazy"/>
                            )
                        }
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