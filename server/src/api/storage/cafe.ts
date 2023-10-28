import { Cafe, MenuItem, Station } from '@prisma/client';
import { prismaClient } from './client.js';
import { ICafeStation, IMenuItem } from '../../models/cafe.js';
import { isUniqueConstraintFailedError } from '../../util/prisma.js';
import { memoByTime } from '../../util/cache.js';
import Duration from '@arcticzeroo/duration';

export const getCafeByIdAsync = async (id: string): Promise<Cafe | null> => {
    return prismaClient.cafe.findUnique({
        where: { id }
    });
}

export const createCafeAsync = async (cafe: Cafe): Promise<Cafe> => {
    return prismaClient.cafe.upsert({
        where:  { id: cafe.id },
        update: cafe,
        create: cafe
    });
}

export const createMenuItemAsync = async (menuItem: IMenuItem, allowUpdateIfExisting: boolean = false): Promise<void> => {
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
        if (!isUniqueConstraintFailedError(err)) {
            throw err;
        }
    }
}

export const createStationAsync = async (station: ICafeStation, allowUpdateIfExisting: boolean = false): Promise<void> => {
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

interface ICreateDailyStationMenuParams {
    cafeId: string;
    dateString: string;
    station: ICafeStation;
}

export const createDailyStationMenuAsync = async ({
                                                      cafeId,
                                                      dateString,
                                                      station,
                                                  }: ICreateDailyStationMenuParams): Promise<void> => {
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
}

export const deleteDailyMenusAsync = async (dateString: string): Promise<void> => {
    // We have cascade delete, so this should delete categories and menu items too
    await prismaClient.dailyStation.deleteMany({
        where: { dateString },
    });
};

export const cachedCafeLogosById = memoByTime(async () => {
    const cafes = await prismaClient.cafe.findMany({
        select: {
            id:       true,
            logoName: true
        }
    });

    return new Map(cafes.map(cafe => [cafe.id, cafe.logoName]));
}, new Duration({ minutes: 30 }).inMilliseconds);

const populateDailyMenuItem = async (menuItem: MenuItem): Promise<IMenuItem> => {
    return {
        id:              menuItem.id,
        name:            menuItem.name,
        description:     menuItem.description,
        price:           menuItem.price.toString(),
        calories:        menuItem.calories?.toString(),
        maxCalories:     menuItem.maxCalories?.toString(),
        imageUrl:        menuItem.imageUrl,
        hasThumbnail:    false,
        thumbnailHeight: undefined,
        thumbnailWidth:  undefined
    };
}

const getMenuForDayAsync = async (cafeId: string, dateString: string): Promise<ICafeStation[]> => {
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
        const station = dailyStation.station;

        const menuItemIdsByCategoryName = new Map<string, Array<string>>();
        const menuItemsById = new Map<string, IMenuItem>();

        for (const category of dailyStation.categories) {
            menuItemIdsByCategoryName.set(category.name, category.menuItems.map(dailyMenuItem => dailyMenuItem.menuItemId));
            const menuItemPromises = category.menuItems.map(dailyMenuItem => populateDailyMenuItem(dailyMenuItem.menuItem));
            // todo: speed this up
            const menuItems = await Promise.all(menuItemPromises);
            for (const menuItem of menuItems) {
                menuItemsById.set(menuItem.id, menuItem);
            }
        }

        stations.push({
            id:      dailyStation.stationId,
            menuId:  station.menuId,
            logoUrl: station.logoUrl,
            name:    station.name,
            menuItemsById,
            menuItemIdsByCategoryName
        });
    }

    return stations;
}

export const menuForDay = memoByTime(async (cafeId: string, dateString: string) => {
    return getMenuForDayAsync(cafeId, dateString);
}, new Duration({ hours: 2 }).inMilliseconds);