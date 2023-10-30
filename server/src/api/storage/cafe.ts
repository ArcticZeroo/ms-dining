import { Cafe, MenuItem, Station } from '@prisma/client';
import { usePrismaClient } from './client.js';
import { ICafe, ICafeConfig, ICafeStation, IMenuItem } from '../../models/cafe.js';
import { isUniqueConstraintFailedError } from '../../util/prisma.js';
import { retrieveExistingThumbnailData } from '../cafe/image/thumbnail.js';
import { logError } from '../../util/log.js';
import { ISearchResult, SearchResultEntityType, SearchResultMatchReason } from '../../models/search.js';
import { getNowWithDaysInFuture, toDateString, yieldDaysInFutureForThisWeek } from '../../util/date.js';
import { fuzzySearch, normalizeNameForSearch } from '../../util/search.js';
import { getThumbnailUrl } from '../../util/cafe.js';

interface ICreateDailyStationMenuParams {
    cafeId: string;
    dateString: string;
    station: ICafeStation;
}

type DailyMenuByCafeId = Map<string, ICafeStation[]>;

export abstract class CafeStorageClient {
    private static readonly _menuItemsById = new Map<string, IMenuItem>();
    private static readonly _cafeDataById = new Map<string, Cafe>();
    private static readonly _cafeMenusByDateString = new Map<string, DailyMenuByCafeId>();

    public static resetCache() {
        this._menuItemsById.clear();
        this._cafeDataById.clear();
        // todo: maybe only reset the cache for today? what about when we reset fully on weekends?
        this._cafeMenusByDateString.clear();
    }

    private static async _ensureCafesExist(): Promise<void> {
        if (this._cafeDataById.size > 0) {
            return;
        }

        const cafes = await usePrismaClient(prismaClient => prismaClient.cafe.findMany());
        for (const cafe of cafes) {
            this._cafeDataById.set(cafe.id, cafe);
        }
    }

    public static async retrieveCafeAsync(id: string): Promise<Cafe | undefined> {
        await this._ensureCafesExist();
        return this._cafeDataById.get(id);
    }

    public static async retrieveCafesAsync(): Promise<ReadonlyMap<string, Cafe>> {
        await this._ensureCafesExist();
        return this._cafeDataById;
    }

    public static async createCafeAsync(cafe: ICafe, config: ICafeConfig): Promise<void> {
        const cafeWithConfig: Cafe = {
            id:               cafe.id,
            name:             cafe.name,
            logoName:         config.logoName,
            contextId:        config.contextId,
            tenantId:         config.tenantId,
            displayProfileId: config.displayProfileId
        };

        await usePrismaClient(prismaClient => prismaClient.cafe.create({
            data: cafeWithConfig
        }));

        this._cafeDataById.set(cafe.id, cafeWithConfig);
    }

    private static async _doCreateMenuItemAsync(menuItem: IMenuItem, allowUpdateIfExisting: boolean): Promise<void> {
        const data: MenuItem = {
            id:          menuItem.id,
            name:        menuItem.name,
            imageUrl:    menuItem.imageUrl,
            description: menuItem.description,
            price:       Number(menuItem.price || 0),
            calories:    Number(menuItem.calories || 0),
            maxCalories: Number(menuItem.maxCalories || 0),
        };

        if (allowUpdateIfExisting) {
            await usePrismaClient(prismaClient => prismaClient.menuItem.upsert({
                where:  { id: menuItem.id },
                update: data,
                create: data
            }));
            return;
        }

        try {
            await usePrismaClient(prismaClient => prismaClient.menuItem.create({ data }));
        } catch (err) {
            // OK to fail unique constraint validation since we don't want to update existing items
            if (!isUniqueConstraintFailedError(err)) {
                throw err;
            }
        }
    }

    public static async createMenuItemAsync(menuItem: IMenuItem, allowUpdateIfExisting: boolean = false): Promise<void> {
        if (!allowUpdateIfExisting && CafeStorageClient._menuItemsById.has(menuItem.id)) {
            return;
        }

        await this._doCreateMenuItemAsync(menuItem, allowUpdateIfExisting);
        // Require the operation to succeed before adding to cache
        this._menuItemsById.set(menuItem.id, menuItem);
    }

    public static async createStationAsync(station: ICafeStation, allowUpdateIfExisting: boolean = false): Promise<void> {
        const data: Station = {
            id:      station.id,
            name:    station.name,
            logoUrl: station.logoUrl,
            menuId:  station.menuId
        };

        if (allowUpdateIfExisting) {
            await usePrismaClient(prismaClient => prismaClient.station.upsert({
                where:  { id: station.id },
                update: data,
                create: data
            }));
            return;
        }

        try {
            await usePrismaClient(prismaClient => prismaClient.station.create({ data }));
        } catch (err) {
            if (!isUniqueConstraintFailedError(err)) {
                throw err;
            }
        }
    }

    public static async deleteDailyMenusAsync(dateString: string) {
        await usePrismaClient(prismaClient => prismaClient.dailyStation.deleteMany({ where: { dateString } }));
    }

    private static _getDailyMenuItemsCreateDataForCategory(station: ICafeStation, menuItemIds: string[]): Array<{
        menuItemId: string
    }> {
        const createItems: Array<{ menuItemId: string }> = [];

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

    private static async _doRetrieveMenuItemAsync(id: string): Promise<IMenuItem | null> {
        const menuItem = await usePrismaClient(prismaClient => prismaClient.menuItem.findUnique({
            where: { id }
        }));

        if (menuItem == null) {
            return null;
        }

        const thumbnailData = await retrieveExistingThumbnailData(id);

        return {
            id:              menuItem.id,
            name:            menuItem.name,
            description:     menuItem.description,
            price:           menuItem.price.toString(),
            calories:        menuItem.calories?.toString(),
            maxCalories:     menuItem.maxCalories?.toString(),
            imageUrl:        menuItem.imageUrl,
            hasThumbnail:    thumbnailData.hasThumbnail,
            thumbnailHeight: thumbnailData.thumbnailHeight,
            thumbnailWidth:  thumbnailData.thumbnailWidth
        };
    }

    public static async retrieveMenuItemAsync(id: string): Promise<IMenuItem | null> {
        if (!this._menuItemsById.has(id)) {
            const menuItem = await this._doRetrieveMenuItemAsync(id);

            if (menuItem == null) {
                return null;
            }

            this._menuItemsById.set(id, menuItem);
        }

        return this._menuItemsById.get(id)!;
    }

    public static async _doRetrieveDailyMenuAsync(cafeId: string, dateString: string) {
        const dailyStations = await usePrismaClient(prismaClient => prismaClient.dailyStation.findMany({
            where:  {
                cafeId,
                dateString
            },
            select: {
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

        const stations: ICafeStation[] = [];

        for (const dailyStation of dailyStations) {
            const stationData = dailyStation.station;

            const menuItemIdsByCategoryName = new Map<string, Array<string>>();
            const menuItemsById = new Map<string, IMenuItem>();

            for (const category of dailyStation.categories) {
                const menuItemIds: string[] = [];

                for (const dailyMenuItem of category.menuItems) {
                    // Don't resolve these in parallel, we can't have too many concurrent requests to SQLite
                    const menuItem = await this.retrieveMenuItemAsync(dailyMenuItem.menuItemId);

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
                id:      dailyStation.stationId,
                menuId:  stationData.menuId,
                logoUrl: stationData.logoUrl,
                name:    stationData.name,
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

    public static async search(query: string): Promise<Map<SearchResultEntityType, Map<string, ISearchResult>>> {
        const cafesById = await CafeStorageClient.retrieveCafesAsync();
        const cafeIds = Array.from(cafesById.keys());
        const dateStrings = Array.from(yieldDaysInFutureForThisWeek()).map(i => toDateString(getNowWithDaysInFuture(i)));

        const dailyStations = await usePrismaClient(prismaClient => prismaClient.dailyStation.findMany({
            where:  {
                cafeId:     { in: cafeIds },
                dateString: { in: dateStrings }
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

        const searchResultsByNameByEntityType = new Map<SearchResultEntityType, Map<string, ISearchResult>>();

        const ensureEntityTypeExists = (entityType: SearchResultEntityType) => {
            if (!searchResultsByNameByEntityType.has(entityType)) {
                searchResultsByNameByEntityType.set(entityType, new Map<string, ISearchResult>());
            }
        }

        interface IAddResultParams {
            type: SearchResultEntityType;
            dateString: string;
            cafeId: string;
            matchReasons: Iterable<SearchResultMatchReason>;
            name: string;
            description?: string;
            imageUrl?: string;
        }

        const addResult = ({
                               type,
                               name,
                               description,
                               imageUrl,
                               dateString,
                               cafeId,
                               matchReasons
                           }: IAddResultParams) => {
            ensureEntityTypeExists(type);

            const searchResultsById = searchResultsByNameByEntityType.get(SearchResultEntityType.MenuItem)!;
            const normalizedName = normalizeNameForSearch(name);

            if (!searchResultsById.has(normalizedName)) {
                searchResultsById.set(normalizedName, {
                    type:                  type,
                    name:                  name,
                    description:           description,
                    imageUrl:              imageUrl,
                    locationDatesByCafeId: new Map<string, Set<string>>(),
                    matchReasons:          new Set<SearchResultMatchReason>(),
                });
            }

            const searchResult = searchResultsById.get(normalizedName)!;

            for (const matchReason of matchReasons) {
                searchResult.matchReasons.add(matchReason);
            }

            if (!searchResult.locationDatesByCafeId.has(cafeId)) {
                searchResult.locationDatesByCafeId.set(cafeId, new Set());
            }
            searchResult.locationDatesByCafeId.get(cafeId)!.add(dateString);
        };


        for (const dailyStation of dailyStations) {
            const stationData = dailyStation.station;

            if (stationData.name.trim() && fuzzySearch(stationData.name, query)) {
                addResult({
                    type:         SearchResultEntityType.Station,
                    matchReasons: [SearchResultMatchReason.Title],
                    dateString:   dailyStation.dateString,
                    cafeId:       dailyStation.cafeId,
                    name:         stationData.name,
                    imageUrl:     stationData.logoUrl
                });
            }

            for (const category of dailyStation.categories) {
                for (const dailyMenuItem of category.menuItems) {
                    const menuItem = await this.retrieveMenuItemAsync(dailyMenuItem.menuItemId);

                    if (menuItem == null) {
                        continue;
                    }

                    const matchReasons: SearchResultMatchReason[] = [];

                    if (fuzzySearch(menuItem.name, query)) {
                        matchReasons.push(SearchResultMatchReason.Title);
                    }

                    if (menuItem.description && fuzzySearch(menuItem.description, query)) {
                        matchReasons.push(SearchResultMatchReason.Description);
                    }

                    if (matchReasons.length > 0) {
                        addResult({
                            type:        SearchResultEntityType.MenuItem,
                            matchReasons,
                            dateString:  dailyStation.dateString,
                            cafeId:      dailyStation.cafeId,
                            name:        menuItem.name,
                            description: menuItem.description,
                            imageUrl:    getThumbnailUrl(menuItem)
                        });
                    }
                }
            }
        }

        return searchResultsByNameByEntityType;
    }
}