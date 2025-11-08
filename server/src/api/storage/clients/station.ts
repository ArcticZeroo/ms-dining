import { isUniqueConstraintFailedError } from '../../../util/prisma.js';
import { usePrismaClient } from '../client.js';
import { Prisma, Station } from '@prisma/client';
import { ICafeStation } from '../../../models/cafe.js';

export abstract class StationStorageClient {
	public static async createStationAsync(station: ICafeStation, allowUpdateIfExisting: boolean = false): Promise<void> {
		const updateData = {
			name:    station.name,
			menuId:  station.menuId,
			cafeId:  station.cafeId,
			logoUrl: station.logoUrl || null
		} satisfies Prisma.StationUpdateArgs['data'];

		if (station.groupId) {
			(updateData as Prisma.StationUpdateArgs['data']).groupId = station.groupId;
		}

		const createData = {
			id: station.id,
			...updateData,
		} satisfies Prisma.StationCreateArgs['data'];

		if (allowUpdateIfExisting) {
			await usePrismaClient(prismaClient => prismaClient.station.upsert({
				where:  { id: station.id },
				update: updateData,
				create: createData
			}));
			return;
		}

		try {
			await usePrismaClient(prismaClient => prismaClient.station.create({ data: createData }));
		} catch (err) {
			if (!isUniqueConstraintFailedError(err)) {
				throw err;
			}
		}
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
}