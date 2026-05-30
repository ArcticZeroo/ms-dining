import { PrismaClient } from '@prisma/client';

export interface SampledIds {
    menuItemIds: string[];
    stationIds: string[];
    cafeIds: string[];
    dateStrings: string[];
    normalizedMenuItemNames: string[];
    normalizedStationNames: string[];
    groupIds: string[];
}

const SAMPLE_SIZE = 200;

const distinct = <T>(arr: T[]): T[] => Array.from(new Set(arr));

export const sampleIds = async (prisma: PrismaClient): Promise<SampledIds> => {
    const [menuItems, stations, cafes, dailyCafes] = await Promise.all([
        prisma.menuItem.findMany({
            select:  { id: true, normalizedName: true, groupId: true },
            take:    SAMPLE_SIZE,
            orderBy: { id: 'asc' },
        }),
        prisma.station.findMany({
            select:  { id: true, normalizedName: true },
            take:    SAMPLE_SIZE,
            orderBy: { id: 'asc' },
        }),
        prisma.cafe.findMany({ select: { id: true }, take: SAMPLE_SIZE }),
        prisma.dailyCafe.findMany({
            select:  { dateString: true },
            distinct: ['dateString'],
            take:    SAMPLE_SIZE,
            orderBy: { dateString: 'desc' },
        }),
    ]);

    return {
        menuItemIds:             menuItems.map(menuItem => menuItem.id),
        stationIds:              stations.map(station => station.id),
        cafeIds:                 cafes.map(cafe => cafe.id),
        dateStrings:             dailyCafes.map(dailyCafe => dailyCafe.dateString),
        normalizedMenuItemNames: distinct(menuItems.map(menuItem => menuItem.normalizedName).filter(normalizedName => normalizedName.length > 0)),
        normalizedStationNames:  distinct(stations.map(station => station.normalizedName).filter(normalizedName => normalizedName.length > 0)),
        groupIds:                distinct(menuItems.map(menuItem => menuItem.groupId).filter((groupId): groupId is string => groupId != null)),
    };
};

export const validateSamples = (samples: SampledIds): void => {
    const empties: string[] = [];
    if (samples.menuItemIds.length === 0) {
        empties.push('menuItemIds');
    }
    if (samples.stationIds.length === 0) {
        empties.push('stationIds');
    }
    if (samples.cafeIds.length === 0) {
        empties.push('cafeIds');
    }
    if (samples.dateStrings.length === 0) {
        empties.push('dateStrings');
    }
    if (samples.normalizedMenuItemNames.length === 0) {
        empties.push('normalizedMenuItemNames');
    }
    if (empties.length > 0) {
        throw new Error(`Source DB is missing data needed for benchmark: ${empties.join(', ')}`);
    }
};
