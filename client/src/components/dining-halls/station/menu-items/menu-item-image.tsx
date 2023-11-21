import React, { useState } from 'react';
import { IMenuItem } from '../../../../models/cafe.ts';
import { Measurement } from '../../../../util/measurement.ts';
import { DiningClient } from '../../../../api/dining.ts';
import { DownscaledImage } from '../../../image/downscaled-image.tsx';
import { ErrorBoundary } from 'react-error-boundary';

const menuItemHeightPx = Measurement.fromRem(10).inPixels;

interface IMenuItemImageProps {
    menuItem: IMenuItem;
}

const getTargetImageUrl = (forceImageFallback: boolean, menuItem: IMenuItem) => {
    if (!forceImageFallback && menuItem.hasThumbnail) {
        return DiningClient.getThumbnailUrlForMenuItem(menuItem);
    }

    return menuItem.imageUrl;
};

const defaultImageProps = {
    decoding:  'async',
    alt:       'Menu item image',
    className: 'menu-item-image',
    loading:   'lazy'
} as const;

const getImageSizeProps = (menuItem: IMenuItem) => {
    // Even if we're using fallback, we should still set these props since we expect the same scale
    if (menuItem.hasThumbnail && menuItem.thumbnailWidth && menuItem.thumbnailHeight) {
        return {
            width:  menuItem.thumbnailWidth,
            height: menuItem.thumbnailHeight
        };
    }

    return {};
};

export const MenuItemImage: React.FC<IMenuItemImageProps> = ({ menuItem }) => {
    const [forceImageFallback, setForceImageFallback] = useState(false);

    const targetImageUrl = getTargetImageUrl(forceImageFallback, menuItem);
    if (!targetImageUrl) {
        console.error('MenuItemImage should not be used on menu items without images');
        return null;
    }

    const imageProps = {
        ...defaultImageProps,
        ...getImageSizeProps(menuItem),
        src: targetImageUrl,
    };

    // Try to downscale the full size image if we can, otherwise just show the full thing
    if (forceImageFallback) {
        console.log('using image fallback on image', menuItem);
        return (
            <ErrorBoundary fallback={<img {...imageProps}/>}>
                <DownscaledImage
                    {...imageProps}
                    maxHeight={menuItemHeightPx}
                />
            </ErrorBoundary>
        );
    }

    return (
        <img
            {...imageProps}
            onError={() => {
                console.log('falling back for menu item', menuItem, 'with props', imageProps);
                setForceImageFallback(true);
            }}
        />
    );
};