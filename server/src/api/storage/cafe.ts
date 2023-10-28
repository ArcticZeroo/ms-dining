import { Cafe, DailyMenuItem, DailyStation, MenuItem, Station } from '@prisma/client';
import { prismaClient } from './client.js';
import { ICafeStation, IMenuItem } from '../../models/cafe.js';
import { stat } from 'fs';
import { isUniqueConstraintFailedError } from '../../util/prisma.js';

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
        name:        menuItem.displayName,
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
        logoUrl: station.logoUrl
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

interface ICreateDailyStationParams {
    cafeId: string;
    stationId: string;
    dateString: string;
}

export const createDailyStationAsync = async ({
                                                  cafeId,
                                                  stationId,
                                                  dateString
                                              }: ICreateDailyStationParams): Promise<DailyStation> => {
    return prismaClient.dailyStation.create({
        data: {
            cafeId,
            stationId,
            dateString
        }
    });
}

export const createDailyMenuItemAsync = async (dailyStationId: number, menuItemId: string): Promise<DailyMenuItem> => {
    return prismaClient.dailyMenuItem.create({
        data: {
            stationId: dailyStationId,
            menuItemId
        }
    });
}

export const deleteDailyMenusAsync = async (dateString: string): Promise<void> => {
    const deleteDailyMenuItems = prismaClient.dailyMenuItem.deleteMany({
        where: {
            station: {
                dateString
            }
        }
    });

    const deleteDailyStations = prismaClient.dailyStation.deleteMany({
        where: { dateString },

    });

    await prismaClient.$transaction([deleteDailyMenuItems, deleteDailyStations]);
};