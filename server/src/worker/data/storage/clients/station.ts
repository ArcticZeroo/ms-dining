import { isUniqueConstraintFailedError } from '../../../../shared/util/prisma.js';
import { usePrismaClient, usePrismaWrite } from '../client.js';
import { Prisma, Station } from '@prisma/client';
import { ICafeStation } from '../../../../shared/models/cafe.js';
import { PrismaLikeClient } from '../../../../shared/models/prisma.js';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import type { IStationRecord, IStationService } from '../../../../shared/services/station.js';

const toStationRecord = (s: Station): IStationRecord => ({
    id:             s.id,
    name:           s.name,
    normalizedName: s.normalizedName,
    logoUrl:        s.logoUrl,
    menuId:         s.menuId,
    groupId:        s.groupId,
    cafeId:         s.cafeId,
});

export abstract class StationStorageClient {
    private static _getStationData(station: ICafeStation) {
        const updateData = {
            name:           station.name,
            normalizedName: normalizeNameForSearch(station.name),
            menuId:         station.menuId,
            cafeId:         station.cafeId,
            logoUrl:        station.logoUrl || null
        } satisfies Prisma.StationUpdateArgs['data'];

        if (station.groupId) {
            (updateData as Prisma.StationUpdateArgs['data']).groupId = station.groupId;
        }

        const createData = {
            id: station.id,
            ...updateData,
        } satisfies Prisma.StationCreateArgs['data'];

        return { updateData, createData };
    }

    public static async createStationWithClientAsync(client: PrismaLikeClient, station: ICafeStation, allowUpdateIfExisting: boolean = false): Promise<void> {
        const { updateData, createData } = this._getStationData(station);

        if (allowUpdateIfExisting) {
            await client.station.upsert({
                where:  { id: station.id },
                update: updateData,
                create: createData
            });
            return;
        }

        try {
            await client.station.create({ data: createData });
        } catch (err) {
            if (!isUniqueConstraintFailedError(err)) {
                throw err;
            }
        }
    }

    public static async createStationAsync(station: ICafeStation, allowUpdateIfExisting: boolean = false): Promise<void> {
        await usePrismaWrite(client => this.createStationWithClientAsync(client, station, allowUpdateIfExisting));
    }

    public static async retrieveStationAsync(stationId: string): Promise<Station | null> {
        return usePrismaClient(prismaClient => prismaClient.station.findUnique({
            where: { id: stationId }
        }));
    }

    public static async retrieveAllStationsWithoutGroup(): Promise<Array<Station>> {
        return usePrismaClient(prismaClient => prismaClient.station.findMany({
            where: {
                groupId: null
            }
        }));
    }

    public static async retrieveAllStationNamesAsync(): Promise<string[]> {
        const stations = await usePrismaClient(prismaClient => prismaClient.station.findMany({
            select: { name: true }
        }));
        return stations.map(station => station.name);
    }
}

/**
 * Worker-side implementation of {@link IStationService}.
 */
export const stationServiceCommands = {
    createStation: async ({ station, allowUpdateIfExisting }: { station: ICafeStation; allowUpdateIfExisting?: boolean }) =>
        StationStorageClient.createStationAsync(station, allowUpdateIfExisting),
    retrieveStation: async ({ stationId }: { stationId: string }) => {
        const s = await StationStorageClient.retrieveStationAsync(stationId);
        return s ? toStationRecord(s) : null;
    },
    retrieveAllStationsWithoutGroup: async (_data: {}) => {
        const stations = await StationStorageClient.retrieveAllStationsWithoutGroup();
        return stations.map(toStationRecord);
    },
    retrieveAllStationNames: async (_data: {}) =>
        StationStorageClient.retrieveAllStationNamesAsync(),
} satisfies IStationService;