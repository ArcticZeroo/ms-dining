import { IMenuItem } from '../../../../models/cafe.ts';
import React from 'react';
import { MenuItem } from './menu-item.tsx';

export interface IMenuCategoryProps {
    categoryName: string;
    menuItems: IMenuItem[];
}

export const MenuCategory: React.FC<IMenuCategoryProps> = ({
    categoryName,
    menuItems
}) => {
    return (
        <>
            <tr>
                <th colSpan={3}>{categoryName}</th>
            </tr>
            {
                menuItems.map(item => (<MenuItem key={item.id} menuItem={item}/>))
            }
        </>
    );
};