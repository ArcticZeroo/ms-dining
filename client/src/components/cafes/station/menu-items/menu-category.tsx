import { IMenuItem } from '../../../../models/cafe.ts';
import React, { useMemo } from 'react';
import { MenuItem } from './menu-item.tsx';

export interface IMenuCategoryProps {
    categoryName: string;
    menuItems: IMenuItem[];
}

export const MenuCategory: React.FC<IMenuCategoryProps> = ({
                                                               categoryName,
                                                               menuItems
                                                           }) => {
    const menuItemList = useMemo(
        () => menuItems.map(item => (<MenuItem key={item.id} menuItem={item}/>)),
        [menuItems]
    );

    return (
        <>
            <tr>
                <th colSpan={3}>{categoryName}</th>
            </tr>
            {menuItemList}
        </>
    );
};