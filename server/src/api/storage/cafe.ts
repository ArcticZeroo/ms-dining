import { Cafe, MenuItem, Station } from '@prisma/client';
import { prismaClient } from './client.js';
import { ICafe, ICafeConfig, ICafeStation, IMenuItem } from '../../models/cafe.js';
import { isUniqueConstraintFailedError } from '../../util/prisma.js';
import { retrieveExistingThumbnailData } from '../cafe/image/thumbnail.js';

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
        await prismaClient.dailyStation.create({
            data: {
                cafeId,
                dateString,
                stationId:  station.id,
                categories: {
                    create: Array.from(station.menuItemIdsByCategoryName.entries()).map(([name, menuItemIds]) => ({
                        name,
                        menuItems: {
                            create: menuItemIds.map(menuItemId => ({ menuItemId }))
                        }
                    }))
                }
            }
        });

        if (!this._cafeMenusByDateString.has(dateString)) {
            this._cafeMenusByDateString.set(dateString, new Map<string, ICafeStation[]>());
        }

        const dailyMenuByCafeId = this._cafeMenusByDateString.get(dateString)!;
        if (!dailyMenuByCafeId.has(cafeId)) {
            dailyMenuByCafeId.set(cafeId, []);
        }

        dailyMenuByCafeId.get(cafeId)!.push(station);
    }

    private static async _doRetrieveMenuItemAsync(id: string): Promise<IMenuItem> {
        const menuItemPromise = prismaClient.menuItem.findUnique({
            where: { id }
        });
        const thumbnailDataPromise = retrieveExistingThumbnailData(id);

        const [menuItem, thumbnailData] = await Promise.all([menuItemPromise, thumbnailDataPromise]);

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

    private static async _retrieveMenuItemAsync(id: string): Promise<IMenuItem> {
        if (!this._menuItemsById.has(id)) {
            const menuItem = await this._doRetrieveMenuItemAsync(id);
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

        const resolveStation = async (dailyStation: typeof dailyStations[0]): Promise<ICafeStation> => {
            const stationData = dailyStation.station;

            const menuItemIdsByCategoryName = new Map<string, Array<string>>();
            const menuItemsById = new Map<string, IMenuItem>();

            for (const category of dailyStation.categories) {
                const menuItemIds: string[] = [];

                for (const dailyMenuItem of category.menuItems) {
                    // Don't resolve these in parallel, we can't have too many concurrent requests to SQLite
                    const menuItem = await this._retrieveMenuItemAsync(dailyMenuItem.menuItemId);
                    menuItemIds.push(dailyMenuItem.menuItemId);
                    menuItemsById.set(menuItem.id, menuItem);
                }

                menuItemIdsByCategoryName.set(category.name, menuItemIds);
            }

            return {
                id:      dailyStation.stationId,
                menuId:  stationData.menuId,
                logoUrl: stationData.logoUrl,
                name:    stationData.name,
                menuItemsById,
                menuItemIdsByCategoryName
            };
        };

        return Promise.all(dailyStations.map(resolveStation));
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