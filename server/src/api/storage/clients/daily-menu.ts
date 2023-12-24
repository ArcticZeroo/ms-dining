import { DateUtil } from '@msdining/common';
import { ICafeStation, IMenuItem } from '../../../models/cafe.js';
import { usePrismaClient } from '../client.js';
import { MenuItemStorageClient } from './menu-item.js';
import { logError } from '../../../util/log.js';
import { getDateStringsForWeek } from '../../../util/date.js';

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

type DailyMenuByCafeId = Map<string, ICafeStation[]>;

// TODO: Clean this up so that it doesn't rely on the MenuItemStorageClient directly.
//   Maybe the storage clients should not have a cache, and we will rely on a higher-level orchestrator to figure out
//   the caching story across all of the storage clients?
export abstract class DailyMenuStorageClient {
    private static readonly _cafeMenusByDateString = new Map<string, DailyMenuByCafeId>();

    public static resetCache() {
        // todo: maybe only reset the cache for today? what about when we reset fully on weekends?
        this._cafeMenusByDateString.clear();
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

        if (!this._cafeMenusByDateString.has(dateString)) {
            this._cafeMenusByDateString.set(dateString, new Map<string, ICafeStation[]>());
        }

        const dailyMenuByCafeId = this._cafeMenusByDateString.get(dateString)!;
        if (!dailyMenuByCafeId.has(cafeId)) {
            dailyMenuByCafeId.set(cafeId, []);
        }

        dailyMenuByCafeId.get(cafeId)!.push(station);
    }

    public static async _doRetrieveDailyMenuAsync(cafeId: string, dateString: string) {
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
                id:             dailyStation.stationId,
                menuId:         stationData.menuId,
                logoUrl:        stationData.logoUrl,
                name:           stationData.name,
                lastUpdateTime: new Date(dailyStation.externalLastUpdateTime),
                menuItemsById,
                menuItemIdsByCategoryName
            });
        }

        return stations;
    }

    public static async retrieveDailyMenuAsync(cafeId: string, dateString: string): Promise<ICafeStation[]> {
        if (!this._cafeMenusByDateString.has(dateString)) {
            this._cafeMenusByDateString.set(dateString, new Map<string, ICafeStation[]>());
        }

        const dailyMenuByCafeId = this._cafeMenusByDateString.get(dateString)!;
        if (!dailyMenuByCafeId.has(cafeId)) {
            dailyMenuByCafeId.set(cafeId, await this._doRetrieveDailyMenuAsync(cafeId, dateString));
        }

        return dailyMenuByCafeId.get(cafeId)!;
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
        const dateStringsForWeek = getDateStringsForWeek();
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

}
