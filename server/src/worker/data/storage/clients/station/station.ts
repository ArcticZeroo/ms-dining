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
    opensAt:        station.opensAt,
    closesAt:       station.closesAt,
});

export abstract class StationStorageClient {
    private static _getStationData(station: ICafeStation) {
        const updateData = {
            name:           station.name,
            normalizedName: normalizeNameForSearch(station.name),
            menuId:         station.menuId,
            cafeId:         station.cafeId,
            logoUrl:        station.logoUrl || null,
            opensAt:        station.opensAt,
            closesAt:       station.closesAt,
            externalMenuLastUpdateTime: station.menuLastUpdateTime ?? new Date(0),
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

    public static async getStationHoursAsync(stationId: string): Promise<{ opensAt: number; closesAt: number } | null> {
        return usePrismaClient(prismaClient => prismaClient.station.findUnique({
            where:  { id: stationId },
            select: { opensAt: true, closesAt: true },
        }));
    }

    public static async getCafeHoursAsync(cafeId: string, dateString: string): Promise<{ opensAt: number; closesAt: number } | null> {
        const stations = await usePrismaClient(prismaClient => prismaClient.dailyStation.findMany({
            where:  { cafeId, dateString },
            select: { station: { select: { opensAt: true, closesAt: true } } },
        }));

        if (stations.length === 0) {
            return null;
        }

        let opensAt = Infinity;
        let closesAt = -Infinity;
        for (const { station } of stations) {
            if (station.opensAt < opensAt) {
                opensAt = station.opensAt;
            }
            if (station.closesAt > closesAt) {
                closesAt = station.closesAt;
            }
        }

        return { opensAt, closesAt };
    }

    public static async getAllCafeHoursAsync(dateString: string): Promise<Map<string, { opensAt: number; closesAt: number }>> {
        const rows = await usePrismaClient(prismaClient => prismaClient.dailyStation.findMany({
            where:  { dateString },
            select: {
                cafeId:  true,
                station: { select: { opensAt: true, closesAt: true } },
            },
        }));

        const hoursByCafe = new Map<string, { opensAt: number; closesAt: number }>();
        for (const { cafeId, station } of rows) {
            const existing = hoursByCafe.get(cafeId);
            if (existing == null) {
                hoursByCafe.set(cafeId, { opensAt: station.opensAt, closesAt: station.closesAt });
            } else {
                if (station.opensAt < existing.opensAt) {
                    existing.opensAt = station.opensAt;
                }
                if (station.closesAt > existing.closesAt) {
                    existing.closesAt = station.closesAt;
                }
            }
        }

        return hoursByCafe;
    }
}