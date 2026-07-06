import { IMenuItem } from '@msdining/common/models/cafe';
import React, { useContext } from 'react';
import { CurrentCafeContext } from '../../../../context/menu-item.ts';
import { MenuItemCard } from './menu-item-card.tsx';
import { MenuItemHeader } from './menu-item-header.tsx';
import { MenuItemImageSection } from './menu-item-image-section.tsx';
import { MenuItemPrice } from './menu-item-price.tsx';
import { MenuItemStats } from './menu-item-stats.tsx';
import { MenuItemButtons } from './popup/menu-item-buttons.tsx';

export interface IMenuItemProps {
    menuItem: IMenuItem;
}

export const MenuItem: React.FC<IMenuItemProps> = ({ menuItem }) => {
    const cafe = useContext(CurrentCafeContext);

    return (
        <MenuItemCard menuItem={menuItem}>
            <MenuItemHeader menuItem={menuItem}/>
            <MenuItemButtons cafeId={cafe.id} menuItem={menuItem}/>
            <MenuItemImageSection menuItem={menuItem}/>
            <MenuItemPrice menuItem={menuItem}/>
            <MenuItemStats menuItem={menuItem}/>
        </MenuItemCard>
    );
};