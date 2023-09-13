import React from 'react';
import { IDiningHallMenuItem } from '../../../models/dining-halls.ts';

export interface IMenuItemProps {
    menuItem: IDiningHallMenuItem;
}

export const MenuItem: React.FC<IMenuItemProps> = ({ menuItem }) => {
    return (
        <li key={menuItem.id}>
            {menuItem.displayName} | ${menuItem.price} | Calories {menuItem.calories}-{menuItem.maxCalories}
        </li>
    );
};