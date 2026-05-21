import { getBadMenuItems } from '@prisma/client/sql';
import { usePrismaWrite } from '../worker/data/storage/client.js';

const badMenuItems = await usePrismaWrite(prisma => {
    return prisma.$queryRawTyped(getBadMenuItems());
});

if (badMenuItems.length > 3) {
    console.error('Too many bad menu items found, aborting deletion to prevent mass data loss.');
    process.exit(1);
}

console.log(`Found ${badMenuItems.length} bad menu items. Deleting...`);
for (const item of badMenuItems) {
    console.log(` - [${item.id}] ${item.name} (station id: ${item.stationId})`);
}

await usePrismaWrite(prisma => {
    return prisma.menuItem.deleteMany({
        where: {
            id: {
                in: badMenuItems.map(item => item.id)
            }
        }
    });
});