import { ICafe, ICafeConfig, IMenuItem } from '../models/cafe.js';
import { getBaseApiUrlWithoutTrailingSlash } from '../constants/cafes.js';

export const getLogoUrl = (cafe: ICafe, config?: ICafeConfig) => {
    if (!config || !config.logoName) {
        return undefined;
    }

    return `${getBaseApiUrlWithoutTrailingSlash(cafe)}/image/${config.tenantId}/${config.contextId}/${config.logoName}`;
}

export const getThumbnailUrl = (menuItem: IMenuItem): string | undefined => {
    if (!menuItem.hasThumbnail) {
        return menuItem.imageUrl;
    }

    return `/static/menu-items/thumbnail/${menuItem.id}.png`;
}