import { isUniqueConstraintFailedError } from '../../../util/prisma.js';
import { usePrismaClient } from '../client.js';
import { Station } from '@prisma/client';
import { ICafeStation } from '../../../models/cafe.js';
import { IAvailabilityPattern } from '@msdining/common/dist/models/pattern.js';
import { patternToString } from '@msdining/common/dist/util/pattern.js';
import { Nullable } from '../../../models/util.js';

export abstract class StationStorageClient {
	public static async createStationAsync(station: ICafeStation, allowUpdateIfExisting: boolean = false): Promise<void> {
		const dataWithoutId: Omit<Station, 'id'> = {
			name:    station.name,
			menuId:  station.menuId,
			logoUrl: station.logoUrl || null,
			pattern: null
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

	public static async setPatternAsync(stationId: string, pattern: Nullable<IAvailabilityPattern>): Promise<void> {
		const patternString = pattern ? patternToString(pattern) : null;

		await usePrismaClient(prismaClient => prismaClient.station.update({
			where: { id: stationId },
			data:  { pattern: patternString }
		}));
	}

	public static doesAnyStationHavePatternAsync(): Promise<boolean> {
		return usePrismaClient(async prismaClient => {
			const station = await prismaClient.station.findFirst({ where: { NOT: { pattern: null } } });
			return station !== null;
		});
	}
}