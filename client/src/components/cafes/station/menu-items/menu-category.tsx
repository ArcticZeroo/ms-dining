import React, { useMemo } from 'react';
import { IMenuItem } from '../../../../models/cafe.ts';
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
        () => menuItems.map(item => (
            <MenuItem
                key={item.id}
                menuItem={item}
            />
        )),
        [menuItems]
    );

    return (
        <div className="flex-col menu-category">
            <div className="category-name">
                {categoryName}
            </div>
            <div className="menu-category-items">
                {menuItemList}
            </div>
        </div>
    );
};