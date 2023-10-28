import { Cafe, MenuItem, Station } from '@prisma/client';
import { prismaClient } from './client.js';

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

export const createStationAsync = async (station: Station): Promise<Station> => {
    return prismaClient.station.upsert({
        where:  { id: station.id },
        update: station,
        create: station
    });
}

export const createMenuItemAsync = async (menuItem: MenuItem): Promise<MenuItem> => {
    return prismaClient.menuItem.upsert({
        where:  { id: menuItem.id },
        update: menuItem,
        create: menuItem
    });
}