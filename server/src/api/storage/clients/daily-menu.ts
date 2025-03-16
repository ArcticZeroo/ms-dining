import { DateUtil } from '@msdining/common';
import { ICafeOverviewStation, IStationUniquenessData } from '@msdining/common/dist/models/cafe.js';
import {
    fromDateString,
    getFridayForWeek,
    getMondayForWeek,
    yieldDaysInRange
} from '@msdining/common/dist/util/date-util.js';
import { normalizeNameForSearch } from '@msdining/common/dist/util/search-util.js';
import { ICafeStation, IMenuItem } from '../../../models/cafe.js';
import { getDefaultUniquenessDataForStation } from '../../../util/cafe.js';
import { isDateValid } from '../../../util/date.js';
import { logError } from '../../../util/log.js';
import { LockedMap } from '../../../util/map.js';
import { usePrismaClient } from '../client.js';
import { MenuItemStorageClient } from './menu-item.js';
import { StationThemeClient } from './station-theme.js';

interface ICreateDailyStationMenuParams {
    cafeId: string;
    dateString: string;
    station: ICafeStation;
}

// TODO: Clean this up so that it doesn't rely on the MenuItemStorageClient directly.
//   Maybe the storage clients should not have a cache, and we will rely on a higher-level orchestrator to figure out
//   the caching story across all of the storage clients?
export abstract class DailyMenuStorageClient {
    private static readonly _cafeMenusByDateString = new Map<string /*dateString*/, LockedMap<string /*cafeId*/, Array<ICafeStation>>>();
    private static readonly _uniquenessData = new LockedMap<string /*cafeId*/, Map<string /*dateString*/, Map<string /*stationName*/, IStationUniquenessData>>>();

    public static resetCache() {
        // todo: maybe only reset the cache for today? what about when we reset fully on weekends?
        this._cafeMenusByDateString.clear();
        this._uniquenessData.clear();
    }

    public static async deleteDailyMenusAsync(dateString: string, cafeId: string) {
        await usePrismaClient(prismaClient => prismaClient.dailyStation.deleteMany({
            where: {
                dateString,
                cafeId
            }
        }));
    }

    private static _getDailyMenuItemsCreateDataForCategory(station: ICafeStation, menuItemIds: string[]): Array<{
        menuItemId: string
    }> {
        const createItems: Array<{
            menuItemId: string
        }> = [];

        for (const menuItemId of menuItemIds) {
            if (!station.menuItemsById.has(menuItemId)) {
                continue;
            }

            createItems.push({ menuItemId });
        }

        return createItems;
    }

    private static _getCachedMenusByCafeIdForDateString(dateString: string) {
        if (!this._cafeMenusByDateString.has(dateString)) {
            this._cafeMenusByDateString.set(dateString, new LockedMap());
        }

        return this._cafeMenusByDateString.get(dateString)!;
    }

    public static async createDailyStationMenuAsync({ cafeId, dateString, station }: ICreateDailyStationMenuParams) {
        await usePrismaClient(async (prismaClient) => prismaClient.dailyStation.create({
            data: {
                cafeId,
                dateString,
                stationId:  station.id,
                categories: {
                    create: Array.from(station.menuItemIdsByCategoryName.entries()).map(([name, menuItemIds]) => ({
                        name,
                        menuItems: {
                            create: this._getDailyMenuItemsCreateDataForCategory(station, menuItemIds)
                        }
                    }))
                }
            }
        }));

        const dailyMenuByCafeId = this._getCachedMenusByCafeIdForDateString(dateString);

        await dailyMenuByCafeId.update(cafeId, async (dailyMenu = []) => {
            dailyMenu.push(station);
            return dailyMenu;
        });
    }

    private static async _doRetrieveDailyMenuAsync(cafeId: string, dateString: string) {
        const dailyStations = await usePrismaClient(prismaClient => prismaClient.dailyStation.findMany({
            where:  {
                cafeId,
                dateString
            },
            select: {
                stationId:              true,
                externalLastUpdateTime: true,
                station:                {
                    select: {
                        name:    true,
                        logoUrl: true,
                        menuId:  true
                    }
                },
                categories:             {
                    select: {
                        name:      true,
                        menuItems: {
                            select: {
                                menuItemId: true
                            }
                        }
                    }
                }
            }
        }));

        const stations: ICafeStation[] = [];

        for (const dailyStation of dailyStations) {
            const stationData = dailyStation.station;

            const menuItemIdsByCategoryName = new Map<string, Array<string>>();
            const menuItemsById = new Map<string, IMenuItem>();

            for (const category of dailyStation.categories) {
                const menuItemIds: string[] = [];

                for (const dailyMenuItem of category.menuItems) {
                    const menuItem = await MenuItemStorageClient.retrieveMenuItemLocallyAsync(dailyMenuItem.menuItemId);

                    if (menuItem == null) {
                        logError(`Unable to find menu item ${dailyMenuItem.menuItemId} for category ${category.name} in station ${stationData.name} (${dailyStation.stationId})`);
                        continue;
                    }

                    menuItemIds.push(dailyMenuItem.menuItemId);
                    menuItemsById.set(menuItem.id, menuItem);
                }

                menuItemIdsByCategoryName.set(category.name, menuItemIds);
            }

            stations.push({
                id:                 dailyStation.stationId,
                menuId:             stationData.menuId,
                logoUrl:            stationData.logoUrl || undefined,
                name:               stationData.name,
                menuLastUpdateTime: isDateValid(dailyStation.externalLastUpdateTime)
                                    ? dailyStation.externalLastUpdateTime
                                    : undefined,
                menuItemsById,
                menuItemIdsByCategoryName
            });
        }

        return stations;
    }

    public static async retrieveDailyMenuAsync(cafeId: string, dateString: string): Promise<ICafeStation[]> {
        const dailyMenuByCafeId = this._getCachedMenusByCafeIdForDateString(dateString);
        return dailyMenuByCafeId.update(cafeId, () => this._doRetrieveDailyMenuAsync(cafeId, dateString));
    }

    public static async retrieveDailyMenuOverviewAsync(cafeId: string, dateString: string): Promise<ICafeOverviewStation[]> {
        const uniquenessDataPromise = this.retrieveUniquenessDataForCafe(cafeId, dateString);
        const resultsPromise = usePrismaClient(prismaClient => prismaClient.dailyStation.findMany({
            where:  {
                cafeId,
                dateString
            },
            select: {
                station: {
                    select: {
                        name:    true,
                        logoUrl: true
                    }
                }
            }
        }));

        const [uniquenessData, results] = await Promise.all([
            uniquenessDataPromise,
            resultsPromise
        ]);

        return results.map(result => {
            const stationName = result.station.name;
            const stationUniquenessData = uniquenessData.get(stationName);

            return {
                name:       stationName,
                logoUrl:    result.station.logoUrl || undefined,
                uniqueness: stationUniquenessData ?? getDefaultUniquenessDataForStation()
            };
        });
    }

    public static async isAnyMenuAvailableForDayAsync(dateString: string): Promise<boolean> {
        const dailyStation = await usePrismaClient(prismaClient => prismaClient.dailyStation.findFirst({
            where:  { dateString },
            select: { id: true }
        }));

        return dailyStation != null;
    }

    public static async isAnyAllowedMenuAvailableForCafe(cafeId: string): Promise<boolean> {
        const currentDate = DateUtil.getMinimumDateForMenu();
        const maximumDate = DateUtil.getMaximumDateForMenu();
        const allowedDateStrings: string[] = [];
        while (!DateUtil.isDateAfter(currentDate, maximumDate)) {
            if (!DateUtil.isDateOnWeekend(currentDate)) {
                allowedDateStrings.push(DateUtil.toDateString(currentDate));
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        const result = await usePrismaClient(client => client.dailyStation.findFirst({
            where: {
                cafeId,
                dateString: {
                    in: allowedDateStrings
                }
            }
        }));

        return result != null;
    }

    public static async getPendingMenusForEmbedding() {
        const dateStrings = DateUtil.getDateStringsForWeek();

        return usePrismaClient(prismaClient => prismaClient.dailyStation.findMany({
            where:  {
                dateString: {
                    in: dateStrings
                }
            },
            select: {
                cafeId:     true,
                dateString: true,
                stationId:  true,
                station:    {
                    select: {
                        name: true
                    }
                },
                categories: {
                    select: {
                        name:      true,
                        menuItems: {
                            select: {
                                menuItemId: true
                            }
                        }
                    }
                }
            }
        }));
    }

    public static getMenusForSearch(date: Date | null) {
        const dateStrings = date != null
                            ? [DateUtil.toDateString(date)]
                            : DateUtil.getDateStringsForWeek();

        return usePrismaClient(prismaClient => prismaClient.dailyStation.findMany({
            where:  {
                dateString: {
                    in: dateStrings
                }
            },
            select: {
                cafeId:     true,
                dateString: true,
                stationId:  true,
                station:    {
                    select: {
                        name:    true,
                        logoUrl: true,
                    }
                },
                categories: {
                    select: {
                        name:      true,
                        menuItems: {
                            select: {
                                menuItemId: true,
                                menuItem:   {
                                    select: {
                                        tags:       true,
                                        searchTags: {
                                            select: {
                                                name: true
                                            }
                                        }
                                    }
                                }
                            },
                        }
                    }
                },
            }
        }));
    }

    private static async _getMenuEntriesForWeek(cafeId: string, targetDate: Date): Promise<Array<[Date, Array<ICafeStation>]>> {
        const mondayDate = getMondayForWeek(targetDate);
        const fridayDate = getFridayForWeek(targetDate);

        const dates = Array.from(yieldDaysInRange(mondayDate, fridayDate));
        const dailyMenus = await Promise.all(dates.map(date => DailyMenuStorageClient.retrieveDailyMenuAsync(cafeId, DateUtil.toDateString(date))));

        return dates.map((date, i) => ([date, dailyMenus[i]!]));
    }

    private static _calculateUniquenessMetrics(entries: Array<[Date, Array<ICafeStation>]>) {
        const stationDaysByName = new Map<string /*stationName*/, number>();
        const itemCountsByStationName = new Map<string /*stationName*/, Map<string /*itemNameNormalized*/, number>>();
        const stationItemsByDay = new Map<string /*dateString*/, Map<string /*stationName*/, Set<string /*normalizedName*/>>>();

        for (const [date, dailyMenu] of entries) {
            const dateString = DateUtil.toDateString(date);
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

    private static async _calculateUniquenessDataForCafe(cafeId: string, targetDateString: string): Promise<Map<string /*dateString*/, Map<string /*stationName*/, IStationUniquenessData>>> {
        const targetDate = fromDateString(targetDateString);
        const menuEntries = await DailyMenuStorageClient._getMenuEntriesForWeek(cafeId, targetDate);

        const metrics = DailyMenuStorageClient._calculateUniquenessMetrics(menuEntries);
        const uniquenessData = new Map<string /*dateString*/, Map<string /*stationName*/, IStationUniquenessData>>();

        // First pass to pre-populate uniqueness data
        // Avoids weird async logic
        for (const [todayDate, todayMenu] of menuEntries) {
            const todayDateString = DateUtil.toDateString(todayDate);

            const todayUniquenessData = uniquenessData.get(todayDateString) ?? new Map<string, IStationUniquenessData>();
            uniquenessData.set(todayDateString, todayUniquenessData);

            for (const station of todayMenu) {
                todayUniquenessData.set(station.name, getDefaultUniquenessDataForStation());
            }
        }

        const calculateUniquenessDataForDay = async ([todayDate, todayMenu]: [Date, Array<ICafeStation>], i: number) => {
            const todayDateString = DateUtil.toDateString(todayDate);

            const todayUniquenessData = uniquenessData.get(todayDateString);
            if (todayUniquenessData == null) {
                logError(cafeId, 'Missing uniqueness data for dateString', todayDateString);
                return;
            }

            let yesterdayUniquenessData: Map<string, IStationUniquenessData> | undefined;
            let yesterdayItemsByStation: Map<string /*stationName*/, Set<string>> | undefined;

            const [yesterdayDate] = menuEntries[i - 1] ?? [];
            if (yesterdayDate) {
                const yesterdayDateString = DateUtil.toDateString(yesterdayDate);
                yesterdayUniquenessData = uniquenessData.get(yesterdayDateString);
                yesterdayItemsByStation = metrics.stationItemsByDay.get(yesterdayDateString);
            }

            let tomorrowItemsByStation: Map<string /*stationName*/, Set<string>> | undefined;
            const [tomorrowDate] = menuEntries[i + 1] ?? [];
            if (tomorrowDate) {
                const tomorrowDateString = DateUtil.toDateString(tomorrowDate);
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

                stationUniquenessData.themeItemIds = Array.from(new Set(Array.from(themeItemsByCategory.values()).flatMap(items => items.map(item => item.id))));
                stationUniquenessData.theme = await StationThemeClient.retrieveThemeAsync(station.name, themeItemsByCategory);
            }
        };

        await Promise.all(menuEntries.map(calculateUniquenessDataForDay));

        return uniquenessData;
    }

    public static async retrieveUniquenessDataForCafe(cafeId: string, targetDateString: string) {
        const targetDate = fromDateString(targetDateString);

        if (DateUtil.isDateOnWeekend(targetDate)) {
            throw new Error('Cannot retrieve uniqueness data for a weekend date');
        }

        // Lock the whole date-string map for each cafe since we update multiple date strings at once.
        const cafeUniquenessData = await this._uniquenessData.update(cafeId, async (cafeUniquenessData = new Map()) => {
            if (!cafeUniquenessData.has(targetDateString)) {
                const calculatedUniquenessData = await this._calculateUniquenessDataForCafe(cafeId, targetDateString);
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

    public static invalidateUniquenessData(cafeId: string) {
        this._uniquenessData.delete(cafeId);
    }

    public static async retrieveCafeChildAvailability(cafeId: string, startDate: Date, endDate: Date) {
        const startString = DateUtil.toDateString(startDate);
        const endString = DateUtil.toDateString(endDate);

        const visits = await usePrismaClient(prismaClient => prismaClient.dailyStation.findMany({
            where:  {
                cafeId,
                dateString: {
                    gte: startString,
                    lte: endString
                }
            },
            select: {
                dateString: true,
                stationId:  true,
                categories: {
                    select: {
                        menuItems: {
                            select: {
                                menuItemId: true
                            }
                        }
                    }
                }
            }
        }));

        const stationVisitsById = new Map<string, Set<string>>();
        const itemVisitsById = new Map<string, Set<string>>();

        for (const stationVisit of visits) {
            const stationId = stationVisit.stationId;
            const visitDate = stationVisit.dateString;

            if (!stationVisitsById.has(stationId)) {
                stationVisitsById.set(stationId, new Set());
            }

            stationVisitsById.get(stationId)!.add(visitDate);

            for (const category of stationVisit.categories) {
                for (const menuItem of category.menuItems) {
                    const menuItemId = menuItem.menuItemId;

                    if (!itemVisitsById.has(menuItemId)) {
                        itemVisitsById.set(menuItemId, new Set());
                    }

                    itemVisitsById.get(menuItemId)!.add(visitDate);
                }
            }
        }

        return {
            stationVisitsById,
            itemVisitsById
        } as const;
    }

    public static async retrieveStationItemAvailability(stationId: string, startDate: Date, endDate: Date) {
        const startString = DateUtil.toDateString(startDate);
        const endString = DateUtil.toDateString(endDate);

        const visits = await usePrismaClient(prismaClient => prismaClient.dailyStation.findMany({
            where:  {
                stationId,
                dateString: {
                    gte: startString,
                    lte: endString
                }
            },
            select: {
                dateString: true,
                categories: {
                    select: {
                        menuItems: {
                            select: {
                                menuItemId: true
                            }
                        }
                    }
                }
            }
        }));

        const itemVisitsById = new Map<string, Set<string>>();
        for (const stationVisit of visits) {
            const visitDate = stationVisit.dateString;

            for (const category of stationVisit.categories) {
                for (const menuItem of category.menuItems) {
                    const menuItemId = menuItem.menuItemId;
                    if (!itemVisitsById.has(menuItemId)) {
                        itemVisitsById.set(menuItemId, new Set());
                    }

                    itemVisitsById.get(menuItemId)!.add(visitDate);
                }
            }
        }

        return itemVisitsById;
    }

    public static async retrieveMenuItemsAvailableTodayFromNames(normalizedNames: Array<string>, date: Date) {
        const dateString = DateUtil.toDateString(date);

        const dailyMenuItems = await usePrismaClient(prismaClient => prismaClient.dailyMenuItem.findMany({
            where:  {
                menuItem: {
                    normalizedName: {
                        in: normalizedNames
                    }
                },
                category: {
                    station: {
                        dateString: {
                            equals: dateString
                        }
                    }
                }
            },
            select: {
                menuItemId: true
            }
        }));

        return new Set(dailyMenuItems.map(item => item.menuItemId));
    }
}