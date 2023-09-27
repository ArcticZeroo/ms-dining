import { IDiningHallMenuItem } from '../../../../models/dining-halls.ts';
import React from 'react';
import { MenuItem } from './menu-item.tsx';

export interface IDiningHallStationMenuCategoryProps {
    categoryName: string;
    menuItems: IDiningHallMenuItem[];
}

export const MenuCategory: React.FC<IDiningHallStationMenuCategoryProps> = ({
                                                                                categoryName,
                                                                                menuItems
                                                                            }) => {
    return (
        <>
            <tr>
                <th>{categoryName}</th>
            </tr>
            {
                menuItems.map(item => (<MenuItem key={item.id} menuItem={item}/>))
            }
        </>
    );
};