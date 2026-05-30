import { getAllMenuItemsWithBadImageUrl } from '@prisma/client/sql';
import { usePrismaTransaction } from '../worker/data/storage/client.js';

console.log('Searching for menu items with bad image URLs...');

await usePrismaTransaction(async prisma => {
    const menuItemsWithBadImageUrl = await prisma.$queryRawTyped(getAllMenuItemsWithBadImageUrl())

    console.log(`Found ${menuItemsWithBadImageUrl.length} menu items with bad image URLs.`);

    for (const menuItem of menuItemsWithBadImageUrl) {
        if (!menuItem.imageUrl) {
            console.warn(`Skipping menu item ID ${menuItem.id} because it has no image URL.`);
            continue;
        }

        console.log(`Fixing menu item ID ${menuItem.id} with image URL "${menuItem.imageUrl}"...`);

        const url = new URL(menuItem.imageUrl, `https://${menuItem.cafeId}.buy-ondemand.com/`);
        await prisma.menuItem.update({
            where: { id: menuItem.id },
            data:  { imageUrl: url.href }
        });
    }
});
