import { IMenuItemBase } from '@msdining/common/models/cafe';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import { retrieveDailyCafeMenuAsync } from '../cache/daily-menu.js';
import { retrieveItemAppearancesForCafe, retrieveUniquenessDataForCafe } from '../cache/daily-uniqueness.js';
import { logError } from '../../util/log.js';
import { canFetchMenuForDateString } from '../../util/date.js';
import { DRINK_FILTER } from '../../util/menu-item-filter.js';

export const DRINK_WEIGHT = 0.75;
export const TRAVELING_WEIGHT = 1.25;

// Per-day weights for an item's appearance count at its station this week.
// Items appearing only 1-2 days are novel and get a small boost; items that
// show up every day are "boring" baseline-menu items and get penalized.
const NOVELTY_BY_DAYS_THIS_WEEK: Record<number, number> = {
	1: 1.15,
	2: 1.05,
	3: 1.0,
	4: 0.85,
	5: 0.7,
};

export const isDrink = (menuItem: IMenuItemBase, stationName: string): boolean => {
	if (DRINK_FILTER.matchesSearchTags(menuItem.searchTags)) {
		return true;
	}
	return DRINK_FILTER.matchesStationOrCategory(stationName);
};

export const computeDrinkWeight = (menuItem: IMenuItemBase, stationName: string): number => {
	return isDrink(menuItem, stationName) ? DRINK_WEIGHT : 1;
};

export const computeNoveltyWeight = (daysThisWeek: number, isTraveling: boolean): number => {
	const baseWeight = NOVELTY_BY_DAYS_THIS_WEEK[daysThisWeek] ?? 1;
	const travelingMultiplier = isTraveling ? TRAVELING_WEIGHT : 1;
	return baseWeight * travelingMultiplier;
};

/**
 * Builds a per-cafe Map<menuItemId, weight> that combines drink and novelty signals.
 * Entries equal to 1 are omitted; consumers should treat missing keys as weight 1.
 *
 * Returns an empty map for weekends (uniqueness data isn't computed for them).
 */
export const buildItemWeightsForCafe = async (
	cafeId: string,
	dateString: string,
): Promise<Map<string /*menuItemId*/, number>> => {
	const weights = new Map<string, number>();

	if (!canFetchMenuForDateString(dateString)) {
		return weights;
	}

	let todaysMenu;
	let uniquenessData;
	let itemDaysByStation;
	try {
		[todaysMenu, uniquenessData, itemDaysByStation] = await Promise.all([
			retrieveDailyCafeMenuAsync(cafeId, dateString),
			retrieveUniquenessDataForCafe(cafeId, dateString),
			retrieveItemAppearancesForCafe(cafeId, dateString),
		]);
	} catch (err) {
		logError(`Failed to build item weights for cafe ${cafeId} on ${dateString}:`, err);
		return weights;
	}

	for (const station of todaysMenu) {
		const stationUniqueness = uniquenessData.get(station.name);
		const isTraveling = stationUniqueness?.isTraveling ?? false;
		const itemDaysForStation = itemDaysByStation.get(station.name);

		for (const menuItem of station.menuItemsById.values()) {
			const normalizedName = normalizeNameForSearch(menuItem.name);
			const daysThisWeek = itemDaysForStation?.get(normalizedName) ?? 1;

			const weight = computeDrinkWeight(menuItem, station.name) * computeNoveltyWeight(daysThisWeek, isTraveling);
			if (weight !== 1) {
				weights.set(menuItem.id, weight);
			}
		}
	}

	return weights;
};
