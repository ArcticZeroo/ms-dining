import { usePrismaClient } from '../api/storage/client.js';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';

console.log('Backfilling Station.normalizedName...');

await usePrismaClient(async prisma => prisma.$transaction(async tx => {
	const stations = await tx.station.findMany({
		where:  { normalizedName: '' },
		select: { id: true, name: true }
	});

	console.log(`Found ${stations.length} stations to backfill.`);

	for (const station of stations) {
		await tx.station.update({
			where: { id: station.id },
			data:  { normalizedName: normalizeNameForSearch(station.name) }
		});
	}

	console.log('Done.');
}));
