import { ICafe, ICafeConfig, ICafeStation, IMenuItem } from '../models/cafe.js';
import { getBaseApiUrlWithoutTrailingSlash } from '../constants/cafes.js';
import { betterLogosByNormalizedName } from '../constants/better-logos.js';
import { normalizeNameForSearch } from '@msdining/common/dist/util/search-util.js';

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

export const normalizeTagName = (tagName: string) => tagName.toLowerCase().trim();

export const getBetterLogoUrl = (stationName: string, stationLogoUrl: string) => {
    const betterLogoUrl = betterLogosByNormalizedName[normalizeNameForSearch(stationName)];
    return betterLogoUrl || stationLogoUrl;
}