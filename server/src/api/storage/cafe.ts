import { CafeTypes, DateUtil } from '@msdining/common';
import {
    Cafe,
    MenuItem,
    MenuItemModifier,
    MenuItemModifierChoice,
    Prisma,
    PrismaClient,
    Station
} from '@prisma/client';
import {
    ICafe,
    ICafeConfig,
    ICafeStation,
    IMenuItem,
} from '../../models/cafe.js';
import { ISearchResult, SearchResultEntityType, SearchResultMatchReason } from '../../models/search.js';
import { getThumbnailUrl } from '../../util/cafe.js';
import { logError } from '../../util/log.js';
import { isUniqueConstraintFailedError } from '../../util/prisma.js';
import { fuzzySearch, normalizeNameForSearch } from '../../util/search.js';
import { retrieveExistingThumbnailData } from '../cafe/image/thumbnail.js';
import { usePrismaClient } from './client.js';

const {
    getMaximumDateForMenuRequest,
    getMinimumDateForMenuRequest,
    isDateAfter,
    isDateOnWeekend,
    toDateString,
} = DateUtil;

type IMenuItemModifier = CafeTypes.IMenuItemModifier;
type IMenuItemModifierChoice = CafeTypes.IMenuItemModifierChoice;
type ModifierChoiceType = CafeTypes.ModifierChoiceType;

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

    private static _doesExistingModifierMatchServer(existingModifier: MenuItemModifier, existingChoices: MenuItemModifierChoice[], serverModifier: IMenuItemModifier): boolean {
        return existingModifier.id === serverModifier.id
            && existingModifier.description === serverModifier.description
            && existingModifier.maximum === serverModifier.maximum
            && existingModifier.minimum === serverModifier.minimum
            && existingModifier.choiceType === serverModifier.choiceType
            && existingChoices.length === serverModifier.choices.length
            && existingChoices.every(existingChoice => {
                const serverChoice = serverModifier.choices.find(choice => choice.id === existingChoice.id);
                return serverChoice != null
                    && existingChoice.description === serverChoice.description
                    && existingChoice.price === serverChoice.price;
            });
    }

    private static async _doCreateModifierChoiceAsync(prismaClient: PrismaClient, modifier: IMenuItemModifier, choice: IMenuItemModifierChoice): Promise<void> {
        const existingChoice = await prismaClient.menuItemModifierChoice.findUnique({
            where: { id: choice.id }
        });

        if (existingChoice != null) {
            // some choices get disconnected from their modifiers somehow, so try to reconnect
            await prismaClient.menuItemModifierChoice.update({
                where: { id: choice.id },
                data:  {
                    description: choice.description,
                    price:       choice.price,
                    modifierId:  modifier.id
                }
            });
        } else {
            await prismaClient.menuItemModifierChoice.create({
                data: {
                    id:          choice.id,
                    description: choice.description,
                    price:       choice.price,
                    modifierId:  modifier.id
                }
            });
        }
    }

    private static async _doCreateSingleModifierAsync(prismaClient: PrismaClient, modifier: IMenuItemModifier): Promise<void> {
        const existingModifier = await prismaClient.menuItemModifier.findUnique({
            where:   { id: modifier.id },
            include: { choices: true }
        });

        if (existingModifier != null && this._doesExistingModifierMatchServer(existingModifier, existingModifier.choices, modifier)) {
            return;
        }

        await prismaClient.menuItemModifierChoice.deleteMany({
            where: {
                modifierId: modifier.id
            }
        });

        // TODO: figure out better typing. UpdateInput doesn't work well here.
        const dataWithoutId = {
            id:          modifier.id,
            description: modifier.description,
            minimum:     modifier.minimum,
            maximum:     modifier.maximum,
            // Maybe a bad idea?
            choiceType: modifier.choiceType as ModifierChoiceType
        };

        if (existingModifier != null) {
            await prismaClient.menuItemModifier.update({
                where: {
                    id: modifier.id,
                },
                data:  dataWithoutId
            });
        } else {
            await prismaClient.menuItemModifier.create({
                data: {
                    ...dataWithoutId,
                    id: modifier.id
                }
            });
        }

        for (const choice of modifier.choices) {
            await this._doCreateModifierChoiceAsync(prismaClient, modifier, choice);
        }
    }

    private static async _doCreateMenuItemAsync(menuItem: IMenuItem, allowUpdateIfExisting: boolean): Promise<void> {
        const lastUpdateTime = menuItem.lastUpdateTime == null || Number.isNaN(menuItem.lastUpdateTime.getTime())
            ? null
            : menuItem.lastUpdateTime;

        const dataWithoutId: Omit<MenuItem, 'id'> & {
            modifiers: Prisma.MenuItemModifierUpdateManyWithoutMenuItemsNestedInput
        } = {
            name:                   menuItem.name,
            imageUrl:               menuItem.imageUrl,
            description:            menuItem.description,
            externalLastUpdateTime: lastUpdateTime,
            price:                  Number(menuItem.price || 0),
            calories:               Number(menuItem.calories || 0),
            maxCalories:            Number(menuItem.maxCalories || 0),
            modifiers:              {
                connect: menuItem.modifiers.map(modifier => ({ id: modifier.id }))
            }
        };

        const data: Prisma.MenuItemCreateInput = {
            id: menuItem.id,
            ...dataWithoutId,
        };

        await usePrismaClient(async prismaClient => {
            // This is kind of messy, but I've chosen this after considering other options.
            // We are many:many, and we don't want to just clear all the modifiers themselves,
            // since that will either throw foreign key errors or sever the connection to other menu items
            // (depending on how we've set up cascade, which at the time of writing is not configured at all).
            // We also want to make sure that options are up-to-date for each modifier: the price, description,
            // or id can change at any time. So, we pull modifiers from db, check if there are any changes, then
            // clear all existing options and do an upsert.
            for (const modifier of menuItem.modifiers) {
                await this._doCreateSingleModifierAsync(prismaClient, modifier);
            }

            if (allowUpdateIfExisting) {
                const existingItem = await prismaClient.menuItem.findUnique({ where: { id: menuItem.id } });
                const doesExist = existingItem != null;

                if (doesExist) {
                    await prismaClient.menuItem.update({
                        where: {
                            id: menuItem.id
                        },
                        data:  dataWithoutId
                    });
                } else {
                    await prismaClient.menuItem.create({
                        data
                    });
                }
            } else {
                try {
                    await prismaClient.menuItem.create({
                        data
                    });
                } catch (err) {
                    // OK to fail unique constraint validation since we don't want to update existing items
                    if (!isUniqueConstraintFailedError(err)) {
                        throw err;
                    }
                }
            }
        });
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
        const dataWithoutId: Omit<Station, 'id'> = {
            name:    station.name,
            menuId:  station.menuId,
            logoUrl: station.logoUrl
        };

        const data: Station = {
            id: station.id,
            ...dataWithoutId,
        };

        if (allowUpdateIfExisting) {
            await usePrismaClient(prismaClient => prismaClient.station.upsert({
                where:  { id: station.id },
                update: dataWithoutId,
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

    private static async _doRetrieveMenuItemAsync(id: string): Promise<IMenuItem | null> {
        const menuItem = await usePrismaClient(prismaClient => prismaClient.menuItem.findUnique({
            where:   { id },
            include: {
                modifiers: {
                    include: {
                        choices: true
                    }
                }
            }
        }));

        if (menuItem == null) {
            return null;
        }

        const thumbnailData = await retrieveExistingThumbnailData(id);

        const modifiers: IMenuItemModifier[] = [];
        for (const modifier of menuItem.modifiers) {
            modifiers.push({
                id:          modifier.id,
                description: modifier.description,
                minimum:     modifier.minimum,
                maximum:     modifier.maximum,
                // Maybe a bad idea?
                choiceType: modifier.choiceType as ModifierChoiceType,
                choices:    modifier.choices.map(choice => ({
                    id:          choice.id,
                    description: choice.description,
                    price:       choice.price
                }))
            });
        }

        return {
            id:              menuItem.id,
            name:            menuItem.name,
            description:     menuItem.description,
            price:           menuItem.price,
            calories:        menuItem.calories,
            maxCalories:     menuItem.maxCalories,
            imageUrl:        menuItem.imageUrl,
            hasThumbnail:    thumbnailData.hasThumbnail,
            thumbnailHeight: thumbnailData.thumbnailHeight,
            thumbnailWidth:  thumbnailData.thumbnailWidth,
            modifiers
        };
    }

    public static async retrieveMenuItemLocallyAsync(id: string): Promise<IMenuItem | null> {
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
                    const menuItem = await this.retrieveMenuItemLocallyAsync(dailyMenuItem.menuItemId);

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

    public static async deleteCafe(cafeId: string): Promise<void> {
        // This is going to be slower but hopefully this rarely ever happens anyway
        await usePrismaClient(client => client.cafe.deleteMany({
            where: { id: cafeId },
        }));
        this._cafeDataById.delete(cafeId);
    }

    public static async search(query: string): Promise<Map<SearchResultEntityType, Map<string, ISearchResult>>> {
        const dateStringsForWeek = Array.from(DateUtil.yieldDaysInFutureForThisWeek()).map(i => DateUtil.toDateString(DateUtil.getNowWithDaysInFuture(i)));
        const dailyStations = await usePrismaClient(prismaClient => prismaClient.dailyStation.findMany({
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

        const searchResultsByNameByEntityType = new Map<SearchResultEntityType, Map<string, ISearchResult>>();

        const ensureEntityTypeExists = (entityType: SearchResultEntityType) => {
            if (!searchResultsByNameByEntityType.has(entityType)) {
                searchResultsByNameByEntityType.set(entityType, new Map<string, ISearchResult>());
            }
        };

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

            const searchResultsById = searchResultsByNameByEntityType.get(type)!;
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
                    const menuItem = await this.retrieveMenuItemLocallyAsync(dailyMenuItem.menuItemId);

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