import { isUniqueConstraintFailedError } from '../../../util/prisma.js';
import { usePrismaClient } from '../client.js';
import { Station } from '@prisma/client';
import { ICafeStation } from '../../../models/cafe.js';

export abstract class StationStorageClient {
	public static async createStationAsync(station: ICafeStation, allowUpdateIfExisting: boolean = false): Promise<void> {
		const dataWithoutId: Omit<Station, 'id'> = {
			name:    station.name,
			menuId:  station.menuId,
			cafeId:  station.cafeId,
			logoUrl: station.logoUrl || null,
			groupId: null
		};

		const data: Station = {
			id: station.id,
			...dataWithoutId,
		};

		if (allowUpdateIfExisting) {
			await usePrismaClient(prismaClient => prismaClient.station.upsert({
				where:  { id: station.id },
				update: dataWithoutId,
				create: data
			}));
			return;
		}

		try {
			await usePrismaClient(prismaClient => prismaClient.station.create({ data }));
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