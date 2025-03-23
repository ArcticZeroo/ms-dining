import { IMenuItem } from '@msdining/common/dist/models/cafe';
import React from 'react';
import { DiningClient } from '../../../../api/dining.ts';

interface IMenuItemImageProps {
    menuItem: IMenuItem;
}

export const MenuItemImage: React.FC<IMenuItemImageProps> = ({ menuItem }) => {
    if (!menuItem.hasThumbnail || menuItem.thumbnailHeight == null || menuItem.thumbnailWidth == null) {
        if (menuItem.imageUrl != null) {
            console.warn(`Menu item ${menuItem.name} has no thumbnail but has an image URL. This should be fixed.`, menuItem);
        }
        return null;
    }

    const targetImageUrl = DiningClient.getThumbnailUrlForMenuItem(menuItem);

    return (
        <img
            decoding="async"
            loading="lazy"
            alt="Menu Item Image"
            className="menu-item-image"
            height={menuItem.thumbnailHeight}
            width={menuItem.thumbnailWidth}
            src={targetImageUrl}
        />
    );
};