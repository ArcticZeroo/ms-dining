import { IStationUniquenessData } from '@msdining/common/models/cafe';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import { betterLogosByNormalizedName } from '../constants/better-logos.js';
import { ALL_CAFES, CAFE_GROUP_LIST, CAFES_BY_ID, getBaseApiUrlWithoutTrailingSlash, GROUPS_BY_ID } from '../constants/cafes.js';
import { CafeGroup, ICafe, ICafeConfig, IMenuItemBase } from '../models/cafe.js';
import { Nullable } from '../models/util.js';
import { toDateString } from '@msdining/common/util/date-util';

export const getLogoUrl = (cafe: ICafe, config?: ICafeConfig) => {
	if (!config?.logoName) {
		return undefined;
	}

	return `${getBaseApiUrlWithoutTrailingSlash(cafe)}/image/${config.tenantId}/${config.contextId}/${config.logoName}`;
};

export const getThumbnailUrl = (menuItem: IMenuItemBase): Nullable<string> => {
	if (!menuItem.hasThumbnail) {
		return menuItem.imageUrl;
	}

	if (menuItem.thumbnailId) {
		return `/static/thumbnails/${menuItem.thumbnailId}.png`;
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
	isTraveling:     false,
	daysThisWeek:    1,
	itemDays:        { 1: itemCount },
	themeItemIds:    [],
	theme:           undefined,
	recentlyAvailableItemCount: 0,
	firstAppearance: toDateString(new Date(0)) // Default to epoch start date since this is used to show newly-added stations
});

const findGroupByAlias = (id: string): CafeGroup | undefined => {
	return CAFE_GROUP_LIST.find(group => group.aliases?.includes(id));
};

const findCafeByAlias = (id: string): ICafe | undefined => {
	return ALL_CAFES.find(cafe => cafe.aliases?.includes(id));
};

export const resolveViewToCafes = (viewId: string): ICafe[] | undefined => {
	const group = GROUPS_BY_ID.get(viewId) ?? findGroupByAlias(viewId);
	if (group) {
		return group.members;
	}

	const cafe = CAFES_BY_ID.get(viewId) ?? findCafeByAlias(viewId);
	if (cafe) {
		return [cafe];
	}

	return undefined;
};