import { Cafe, MenuItem, Station } from '@prisma/client';
import { prismaClient } from './client.js';
import { ICafe, ICafeConfig, ICafeStation, IMenuItem } from '../../models/cafe.js';
import { isUniqueConstraintFailedError } from '../../util/prisma.js';
import { retrieveExistingThumbnailData } from '../cafe/image/thumbnail.js';
import { logError } from '../../util/log.js';

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

        const cafes = await prismaClient.cafe.findMany();
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

        await prismaClient.cafe.create({
            data: cafeWithConfig
        });

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
            await prismaClient.menuItem.upsert({
                where:  { id: menuItem.id },
                update: data,
                create: data
            });
            return;
        }

        try {
            await prismaClient.menuItem.create({ data });
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
            await prismaClient.station.upsert({
                where:  { id: station.id },
                update: data,
                create: data
            });
            return;
        }

        try {
            await prismaClient.station.create({ data });
        } catch (err) {
            if (!isUniqueConstraintFailedError(err)) {
                throw err;
            }
        }
    }

    public static async deleteDailyMenusAsync(dateString: string) {
        // We have cascade delete, so this should delete categories and menu items too
        await prismaClient.dailyStation.deleteMany({
            where: { dateString },
        });
    }

    public static async createDailyStationMenuAsync({ cafeId, dateString, station }: ICreateDailyStationMenuParams) {
        // Nested query here seems to cause a foreign key error due to things being created in the wrong order.
        const dailyStation = await prismaClient.dailyStation.create({
            data: {
                cafeId,
                dateString,
                stationId: station.id
            }
        });

        for (const [categoryName, menuItemIds] of station.menuItemIdsByCategoryName.entries()) {
            const dailyCategory = await prismaClient.dailyCategory.create({
                data: {
                    name: categoryName,
                    stationId: dailyStation.id
                }
            });

            for (const menuItemId of menuItemIds) {
                // Categories may list menu item ids that have been 86-ed, which we don't find out until we try to
                // retrieve the menu item. So, if the menu item id is in the list of possible menu items, but isn't
                // in the map for menu item data, it won't be on the menu today anyways.
                if (!station.menuItemsById.has(menuItemId)) {
                    continue;
                }

                await prismaClient.dailyMenuItem.create({
                    data: {
                        menuItemId,
                        categoryId: dailyCategory.id
                    }
                });
            }
        }

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
        const menuItem = await prismaClient.menuItem.findUnique({
            where: { id }
        });

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
        const dailyStations = await prismaClient.dailyStation.findMany({
            where:   {
                cafeId,
                dateString
            },
            include: {
                station:    {
                    select: {
                        name:    true,
                        logoUrl: true,
                        menuId:  true
                    }
                },
                categories: {
                    select:  {
                        name: true
                    },
                    include: {
                        menuItems: {
                            include: {
                                menuItem: true
                            }
                        }
                    }
                }
            }
        });

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
}