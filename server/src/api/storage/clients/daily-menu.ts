import { DateUtil } from '@msdining/common';
import { ICafeStation, IMenuItem } from '../../../models/cafe.js';
import { isDateValid } from '../../../util/date.js';
import { logError } from '../../../util/log.js';
import { LockedMap } from '../../../util/map.js';
import { usePrismaClient } from '../client.js';
import { MenuItemStorageClient } from './menu-item.js';
import { IStationUniquenessData } from '@msdining/common/dist/models/cafe.js';
import {
    fromDateString,
    getFridayForWeek,
    getMondayForWeek,
    yieldDaysInRange
} from '@msdining/common/dist/util/date-util.js';
import { normalizeNameForSearch } from '@msdining/common/dist/util/search-util.js';

const {
    getMaximumDateForMenuRequest,
    getMinimumDateForMenuRequest,
    isDateAfter,
    isDateOnWeekend,
    toDateString,
} = DateUtil;

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
                        menuId:  true,
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

    public static async isAnyMenuAvailableForDayAsync(dateString: string): Promise<boolean> {
        const dailyStation = await usePrismaClient(prismaClient => prismaClient.dailyStation.findFirst({
            where:  { dateString },
            select: { id: true }
        }));

        return dailyStation != null;
    }

    public static async isAnyAllowedMenuAvailableForCafe(cafeId: string): Promise<boolean> {
        const currentDate = getMinimumDateForMenuRequest();
        const maximumDate = getMaximumDateForMenuRequest();
        const allowedDateStrings: string[] = [];
        while (!isDateAfter(currentDate, maximumDate)) {
            if (!isDateOnWeekend(currentDate)) {
                allowedDateStrings.push(toDateString(currentDate));
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

    public static getAllMenusForWeek() {
        const dateStringsForWeek = DateUtil.getDateStringsForWeek();

        return usePrismaClient(prismaClient => prismaClient.dailyStation.findMany({
            where:  {
                dateString: {
                    in: dateStringsForWeek
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
                        menuId:  true
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

    private static async _calculateUniquenessDataForCafe(cafeId: string, targetDateString: string) {
        const targetDate = fromDateString(targetDateString);

        const mondayDate = getMondayForWeek(targetDate);
        const fridayDate = getFridayForWeek(targetDate);

        const stationCountByName = new Map<string /*stationName*/, number>();
        const itemCountsByStationName = new Map<string /*stationName*/, Map<string /*itemNameNormalized*/, number>>();

        const dates = Array.from(yieldDaysInRange(mondayDate, fridayDate));
        const dailyMenus = await Promise.all(dates.map(date => DailyMenuStorageClient.retrieveDailyMenuAsync(cafeId, toDateString(date))));

        for (const dailyMenu of dailyMenus) {
            for (const station of dailyMenu) {
                // In some cases (e.g. half vs whole sandwich) there are multiple items with the same name at one station
                const seenItemNames = new Set<string>();

                const stationName = station.name;

                const currentStationCount = stationCountByName.get(stationName) ?? 0;
                stationCountByName.set(stationName, currentStationCount + 1);

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

        const uniquenessData = new Map<string /*dateString*/, Map<string /*stationName*/, IStationUniquenessData>>();

        for (let i = 0; i < dates.length; i++) {
            const currentDate = dates[i]!;
            const dailyMenu = dailyMenus[i]!;

            const currentDateString = toDateString(currentDate);

            const currentUniquenessData = new Map<string /*stationName*/, IStationUniquenessData>();
            uniquenessData.set(currentDateString, currentUniquenessData);

            for (const station of dailyMenu) {
                const stationCount = stationCountByName.get(station.name) ?? 0;
                const itemCountsForStation = itemCountsByStationName.get(station.name);

                if (stationCount <= 0 || stationCount > 5 || itemCountsForStation == null) {
                    // Something weird happened.
                    logError(`Station ${station.name} has erroneous data for date ${currentDateString}`);
                    continue;
                }

                const itemCounts: Record<number, number> = {};

                for (const menuItem of station.menuItemsById.values()) {
                    const itemNameNormalized = normalizeNameForSearch(menuItem.name);

                    const itemCount = itemCountsForStation.get(itemNameNormalized) ?? 0;

                    if (itemCount <= 0 || itemCount > 5) {
                        // Something weird happened.
                        logError(`Item ${menuItem.name} has erroneous data for date ${currentDateString}: ${itemCount}`);
                        continue;
                    }

                    itemCounts[itemCount] = (itemCounts[itemCount] ?? 0) + 1;
                }

                currentUniquenessData.set(station.name, {
                    daysThisWeek: stationCount,
                    itemDays:     itemCounts
                });
            }
        }

        return uniquenessData;
    }

    public static async retrieveUniquenessDataForCafe(cafeId: string, targetDateString: string) {
        const targetDate = fromDateString(targetDateString);

        if (isDateOnWeekend(targetDate)) {
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
}
