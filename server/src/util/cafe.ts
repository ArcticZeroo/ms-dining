import { IStationUniquenessData } from '@msdining/common/dist/models/cafe.js';
import { normalizeNameForSearch } from '@msdining/common/dist/util/search-util.js';
import { betterLogosByNormalizedName } from '../constants/better-logos.js';
import { getBaseApiUrlWithoutTrailingSlash } from '../constants/cafes.js';
import { ICafe, ICafeConfig, IMenuItem } from '../models/cafe.js';
import { Nullable } from '../models/util.js';

export const getLogoUrl = (cafe: ICafe, config?: ICafeConfig) => {
    if (!config?.logoName) {
        return undefined;
    }

    return `${getBaseApiUrlWithoutTrailingSlash(cafe)}/image/${config.tenantId}/${config.contextId}/${config.logoName}`;
};

export const getThumbnailUrl = (menuItem: IMenuItem): Nullable<string> => {
    if (!menuItem.hasThumbnail) {
        return menuItem.imageUrl;
    }

    return `/static/menu-items/thumbnail/${menuItem.id}.png`;
};

export const normalizeTagName = (tagName: string) => tagName.toLowerCase().trim();

export const getStationLogoUrl = (stationName: string, stationLogoUrl?: Nullable<string>) => {
    const betterLogoUrl = betterLogosByNormalizedName[normalizeNameForSearch(stationName)];
    return betterLogoUrl || stationLogoUrl;
};

export const serializeMenuItemTags = (tags: Iterable<string>) => {
    const tagsArray = Array.from(tags);
    if (tagsArray.length === 0) {
        return null;
    }
    return tagsArray.join(';');
};

export const deserializeMenuItemTags = (tags: string | null | undefined) => new Set(tags?.split(';') ?? []);

export const getDefaultUniquenessDataForStation = (itemCount: number = 0): IStationUniquenessData => ({
    isTraveling:  false,
    daysThisWeek: 1,
    itemDays:     { 1: itemCount },
    themeItemIds: [],
    theme:        undefined
});