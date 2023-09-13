import React from 'react';
import { IDiningHallMenuItem } from '../../../../models/dining-halls.ts';

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
    const caloriesDisplay = getCaloriesDisplay(menuItem);
    return (
        <tr>
            <td>
                {menuItem.displayName}
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