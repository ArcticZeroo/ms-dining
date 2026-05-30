import { isUniqueConstraintFailedError } from '../../../../../shared/util/prisma.js';
import { usePrismaClient, usePrismaWrite } from '../../client.js';
import { Prisma, Station } from '@prisma/client';
import { ICafeStation } from '../../../../../shared/models/cafe.js';
import { PrismaLikeClient } from '../../../../../shared/models/prisma.js';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import type { IStationRecord } from '../../../../../shared/services/station.js';

export const toStationRecord = (station: Station): IStationRecord => ({
    id:             station.id,
    name:           station.name,
    normalizedName: station.normalizedName,
    logoUrl:        station.logoUrl,
    menuId:         station.menuId,
    groupId:        station.groupId,
    cafeId:         station.cafeId,
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

    public static async retrieveAllStationsAsync(): Promise<Array<Station>> {
        return usePrismaClient(prismaClient => prismaClient.station.findMany());
    }

    public static async retrieveAllStationNamesAsync(): Promise<string[]> {
        const stations = await usePrismaClient(prismaClient => prismaClient.station.findMany({
            select: { name: true }
        }));
        return stations.map(station => station.name);
    }
}