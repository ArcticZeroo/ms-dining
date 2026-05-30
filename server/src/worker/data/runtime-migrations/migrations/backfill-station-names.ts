import { usePrismaTransaction } from '../../storage/client.js';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import { logInfo } from '../../../../shared/util/log.js';
import { IRuntimeMigration } from '../types.js';

export const backfillStationNames: IRuntimeMigration = {
    name:        'backfill-station-normalized-names',
    description: 'Backfill Station.normalizedName for stations where it is empty',
    runMode:     'blocking',
    async run() {
        await usePrismaTransaction(async (prisma) => {
            const stations = await prisma.station.findMany({
                where:  { normalizedName: '' },
                select: { id: true, name: true }
            });

            logInfo(`[Migrations] Found ${stations.length} stations to backfill normalizedName.`);

            for (const station of stations) {
                await prisma.station.update({
                    where: { id: station.id },
                    data:  { normalizedName: normalizeNameForSearch(station.name) }
                });
            }
        });
    }
};
