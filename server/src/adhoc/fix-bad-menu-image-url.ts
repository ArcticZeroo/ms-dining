import { getAllMenuItemsWithBadImageUrl } from '@prisma/client/sql';
import { usePrismaClient } from '../api/storage/client.js';

console.log('Searching for menu items with bad image URLs...');

await usePrismaClient(async prisma => prisma.$transaction(async tx => {
	const menuItemsWithBadImageUrl = await tx.$queryRawTyped(getAllMenuItemsWithBadImageUrl())

	console.log(`Found ${menuItemsWithBadImageUrl.length} menu items with bad image URLs.`);

	for (const menuItem of menuItemsWithBadImageUrl) {
		if (!menuItem.imageUrl) {
			console.warn(`Skipping menu item ID ${menuItem.id} because it has no image URL.`);
			continue;
		}

		console.log(`Fixing menu item ID ${menuItem.id} with image URL "${menuItem.imageUrl}"...`);

		const url = new URL(menuItem.imageUrl, `https://${menuItem.cafeId}.buy-ondemand.com/`);
		await tx.menuItem.update({
			where: { id: menuItem.id },
			data:  { imageUrl: url.href }
		});
	}
}));
