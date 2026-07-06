import { IMenuItem } from '@msdining/common/models/cafe';
import React from 'react';
import { ApplicationSettings } from '../../../../constants/settings.ts';
import { useValueNotifier } from '../../../../hooks/events.ts';
import { MenuItemImage } from './menu-item-image.tsx';

interface IMenuItemImageSectionProps {
    menuItem: IMenuItem;
}

export const MenuItemImageSection: React.FC<IMenuItemImageSectionProps> = ({ menuItem }) => {
    const showImages = useValueNotifier(ApplicationSettings.showImages);

    if (!showImages || (!menuItem.hasThumbnail && menuItem.imageUrl == null)) {
        return null;
    }

    return (
        <div className="centered-content">
            <MenuItemImage menuItem={menuItem}/>
        </div>
    );
};
