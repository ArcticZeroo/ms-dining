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

    return `Calories: ${parts.join('-')}`;
};

export const MenuItem: React.FC<IMenuItemProps> = ({ menuItem }) => {
    const caloriesDisplay = getCaloriesDisplay(menuItem);
    return (
        <li key={menuItem.id}>
            {menuItem.displayName} | ${menuItem.price}{caloriesDisplay && ` | ${caloriesDisplay}`}
        </li>
    );
};