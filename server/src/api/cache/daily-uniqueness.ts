import { LockedMap } from '../../util/map.js';
import { IMenuItem, IStationUniquenessData } from '@msdining/common/dist/models/cafe.js';
import { CACHE_EVENTS } from '../storage/events.js';
import {
	fromDateString,
	getFridayForWeek,
	getMondayForWeek,
	isDateOnWeekend,
	toDateString,
	yieldDaysInRange
} from '@msdining/common/dist/util/date-util.js';
import { hasAnythingChangedInPublishedMenu, IMenuPublishEvent } from '../../models/storage-events.js';
import { logError } from '../../util/log.js';
import { ICafeStation } from '../../models/cafe.js';
import { normalizeNameForSearch } from '@msdining/common/dist/util/search-util.js';
import { getDefaultUniquenessDataForStation } from '../../util/cafe.js';
import { StationThemeClient } from '../storage/clients/station-theme.js';
import { retrieveDailyCafeMenuAsync } from './daily-menu.js';
import { retrieveFirstStationAppearance } from './station-first-appearance.js';

const UNIQUENESS_DATA = new LockedMap<string /*cafeId*/, Map<string /*dateString*/, Map<string /*stationName*/, IStationUniquenessData>>>();

const getMenuEntriesForWeek = async (cafeId: string, targetDate: Date): Promise<Array<[Date, Array<ICafeStation>]>> => {
	const mondayDate = getMondayForWeek(targetDate);
	const fridayDate = getFridayForWeek(targetDate);

	const dates = Array.from(yieldDaysInRange(mondayDate, fridayDate));
	const dailyMenus = await Promise.all(dates.map(date => retrieveDailyCafeMenuAsync(cafeId, toDateString(date))));

	return dates.map((date, i) => ([date, dailyMenus[i]!]));
}

const calculateWeeklyUniquenessMetrics = (entries: Array<[Date, Array<ICafeStation>]>) => {
	const stationDaysByName = new Map<string /*stationName*/, number>();
	const itemCountsByStationName = new Map<string /*stationName*/, Map<string /*itemNameNormalized*/, number>>();
	const stationItemsByDay = new Map<string /*dateString*/, Map<string /*stationName*/, Set<string /*normalizedName*/>>>();

	for (const [date, dailyMenu] of entries) {
		const dateString = toDateString(date);
		const itemsTodayPerStation = stationItemsByDay.get(dateString) ?? new Map<string /*stationName*/, Set<string /*normalizedName*/>>();
		stationItemsByDay.set(dateString, itemsTodayPerStation);

		for (const station of dailyMenu) {
			const stationName = station.name;

			// In some cases (e.g. half vs whole sandwich) there are multiple items with the same name at one station
			const seenItemNames = itemsTodayPerStation.get(stationName) ?? new Set<string>();
			itemsTodayPerStation.set(stationName, seenItemNames);

			const currentStationCount = stationDaysByName.get(stationName) ?? 0;
			stationDaysByName.set(stationName, currentStationCount + 1);

			if (!itemCountsByStationName.has(stationName)) {
				itemCountsByStationName.set(stationName, new Map());
			}

			const itemCountsForStation = itemCountsByStationName.get(stationName)!;
			for (const menuItem of station.menuItemsById.values()) {
				const itemNameNormalized = normalizeNameForSearch(menuItem.name);

				if (seenItemNames.has(itemNameNormalized)) {
					continue;
				}

				seenItemNames.add(itemNameNormalized);

				const currentItemCount = itemCountsForStation.get(itemNameNormalized) ?? 0;
				itemCountsForStation.set(itemNameNormalized, currentItemCount + 1);
			}
		}
	}

	return { stationItemsByDay, stationDaysByName, itemCountsByStationName } as const;
}

const calculateWeeklyUniquenessDataForCafe = async (cafeId: string, targetDateString: string): Promise<Map<string /*dateString*/, Map<string /*stationName*/, IStationUniquenessData>>> => {
	const targetDate = fromDateString(targetDateString);
	const menuEntries = await getMenuEntriesForWeek(cafeId, targetDate);

	const metrics = calculateWeeklyUniquenessMetrics(menuEntries);
	const uniquenessData = new Map<string /*dateString*/, Map<string /*stationName*/, IStationUniquenessData>>();
	const firstVisitByStationIdPromises = new Map<string, Promise<Date | null>>();

	// First pass to pre-populate uniqueness data
	// Avoids weird async logic
	for (const [todayDate, todayMenu] of menuEntries) {
		const todayDateString = toDateString(todayDate);

		const todayUniquenessData = uniquenessData.get(todayDateString) ?? new Map<string, IStationUniquenessData>();
		uniquenessData.set(todayDateString, todayUniquenessData);

		for (const station of todayMenu) {
			todayUniquenessData.set(station.name, getDefaultUniquenessDataForStation());

			if (!firstVisitByStationIdPromises.has(station.id)) {
				firstVisitByStationIdPromises.set(station.id, retrieveFirstStationAppearance(station.id));
			}
		}
	}

	const calculateUniquenessDataForDay = async ([todayDate, todayMenu]: [Date, Array<ICafeStation>], i: number) => {
		const todayDateString = toDateString(todayDate);

		const todayUniquenessData = uniquenessData.get(todayDateString);
		if (todayUniquenessData == null) {
			logError(cafeId, 'Missing uniqueness data for dateString', todayDateString);
			return;
		}

		let yesterdayUniquenessData: Map<string, IStationUniquenessData> | undefined;
		let yesterdayItemsByStation: Map<string /*stationName*/, Set<string>> | undefined;

		const [yesterdayDate] = menuEntries[i - 1] ?? [];
		if (yesterdayDate) {
			const yesterdayDateString = toDateString(yesterdayDate);
			yesterdayUniquenessData = uniquenessData.get(yesterdayDateString);
			yesterdayItemsByStation = metrics.stationItemsByDay.get(yesterdayDateString);
		}

		let tomorrowItemsByStation: Map<string /*stationName*/, Set<string>> | undefined;
		const [tomorrowDate] = menuEntries[i + 1] ?? [];
		if (tomorrowDate) {
			const tomorrowDateString = toDateString(tomorrowDate);
			tomorrowItemsByStation = metrics.stationItemsByDay.get(tomorrowDateString);
		}

		for (const station of todayMenu) {
			const stationUniquenessData = todayUniquenessData.get(station.name);
			if (stationUniquenessData == null) {
				logError(cafeId, todayDateString, 'Missing station uniqueness data for', station.name);
				continue;
			}

			const wasHereYesterday = yesterdayUniquenessData?.has(station.name) ?? false;
			if (wasHereYesterday && yesterdayUniquenessData != null) {
				yesterdayUniquenessData.get(station.name)!.isTraveling = false;
			} else if (wasHereYesterday) {
				logError(cafeId, todayDateString, 'Something went wrong... yesterdayUniquenessData is missing');
			}

			stationUniquenessData.isTraveling = !wasHereYesterday;
			stationUniquenessData.daysThisWeek = metrics.stationDaysByName.get(station.name) ?? 0;
			const itemCountsForStation = metrics.itemCountsByStationName.get(station.name);

			if (stationUniquenessData.daysThisWeek <= 0 || stationUniquenessData.daysThisWeek > 5 || itemCountsForStation == null) {
				// Something weird happened.
				logError(cafeId, todayDateString, `Station ${station.name} has erroneous data for date ${todayDateString}`);
				continue;
			}

			const themeItemsByCategory = new Map<string /*categoryName*/, Array<IMenuItem>>();

			const itemsYesterday = yesterdayItemsByStation?.get(station.name);
			const itemsTomorrow = tomorrowItemsByStation?.get(station.name);

			for (const [category, categoryMenuItemIds] of station.menuItemIdsByCategoryName) {
				for (const menuItemId of categoryMenuItemIds) {
					const menuItem = station.menuItemsById.get(menuItemId);
					if (!menuItem) {
						logError(`Missing menu item ${menuItemId}`);
						continue;
					}

					const itemNameNormalized = normalizeNameForSearch(menuItem.name);

					const itemDaysAtStation = itemCountsForStation.get(itemNameNormalized) ?? 0;

					if (itemDaysAtStation <= 0 || itemDaysAtStation > 5) {
						// Something weird happened.
						logError(`Item ${menuItem.name} has erroneous data for date ${todayDateString}: ${itemDaysAtStation}`);
						continue;
					}

					if (!itemsYesterday?.has(itemNameNormalized) && !itemsTomorrow?.has(itemNameNormalized)) {
						const themeItemsForCategory = themeItemsByCategory.get(category) ?? [];
						themeItemsByCategory.set(category, themeItemsForCategory);
						themeItemsForCategory.push(menuItem);
					}

					stationUniquenessData.itemDays[itemDaysAtStation] = (stationUniquenessData.itemDays[itemDaysAtStation] ?? 0) + 1;
				}
			}

			const firstVisit = await firstVisitByStationIdPromises.get(station.id);
			if (firstVisit) {
				stationUniquenessData.firstAppearance = toDateString(firstVisit);
			} else {
				logError(`Missing first visit for station ${station.name} (${station.id}) in cafe ${cafeId}`);
			}

			stationUniquenessData.themeItemIds = Array.from(new Set(Array.from(themeItemsByCategory.values()).flatMap(items => items.map(item => item.id))));
			stationUniquenessData.theme = await StationThemeClient.retrieveThemeAsync(station.name, themeItemsByCategory);
		}
	};

	await Promise.all(menuEntries.map(calculateUniquenessDataForDay));

	return uniquenessData;
}

export const retrieveUniquenessDataForCafe = async (cafeId: string, targetDateString: string, forceUpdate: boolean = false) => {
	const targetDate = fromDateString(targetDateString);

	if (isDateOnWeekend(targetDate)) {
		throw new Error('Cannot retrieve uniqueness data for a weekend date');
	}

	// Lock the whole date-string map for each cafe since we update multiple date strings at once.
	const cafeUniquenessData = await UNIQUENESS_DATA.update(cafeId, async (cafeUniquenessData = new Map()) => {
		if (!cafeUniquenessData.has(targetDateString) || forceUpdate) {
			const calculatedUniquenessData = await calculateWeeklyUniquenessDataForCafe(cafeId, targetDateString);
			for (const [dateString, data] of calculatedUniquenessData.entries()) {
				cafeUniquenessData.set(dateString, data);
			}
		}

		return cafeUniquenessData;
	});

	// Map<stationName, IStationUniquenessData>
	const uniquenessDataForDate = cafeUniquenessData.get(targetDateString);
	if (uniquenessDataForDate == null) {
		// Probably shouldn't ever happen. Could happen if we don't have menus for the given date.
		throw new Error(`Unable to find uniqueness data for date ${targetDateString} in cafe id ${cafeId}`);
	}

	return uniquenessDataForDate;
}

CACHE_EVENTS.on('menuPublished', (event: IMenuPublishEvent) => {
	if (!hasAnythingChangedInPublishedMenu(event)) {
		return;
	}

	retrieveUniquenessDataForCafe(event.cafe.id, event.dateString, true /*forceUpdate*/)
		.catch(err => logError('Failed to update uniqueness data on menu publish:', err));
});
