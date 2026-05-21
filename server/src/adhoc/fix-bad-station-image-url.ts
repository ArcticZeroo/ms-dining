import { getAllStationsWithBadImageUrl } from '@prisma/client/sql';
import { usePrismaTransaction } from '../worker/data/storage/client.js';

console.log('Searching for menu items with bad image URLs...');

await usePrismaTransaction(async tx => {
    const stationsWithBadImageUrl = await tx.$queryRawTyped(getAllStationsWithBadImageUrl());

    console.log(`Found ${stationsWithBadImageUrl.length} stations with bad image URLs.`);

    for (const station of stationsWithBadImageUrl) {
        if (!station.logoUrl) {
            console.warn(`Skipping station ${station.id} because it has no image URL.`);
            continue;
        }

        console.log(`Fixing station ${station.id} with image URL "${station.logoUrl}"...`);

        const url = new URL(station.logoUrl, `https://${station.cafeId}.buy-ondemand.com/`);
        await tx.station.update({
            where: { id: station.id },
            data:  { logoUrl: url.href }
        });
    }
});
