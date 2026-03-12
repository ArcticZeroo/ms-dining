import { BuyOnDemandClient, JSON_HEADERS } from '../api/cafe/buy-ondemand/buy-ondemand-client.js';
import { retrieveStationListAsync } from '../api/cafe/buy-ondemand/stations.js';
import { retrieveMenuItemsAsync } from '../api/cafe/buy-ondemand/menu-items.js';
import { ICafe } from '../models/cafe.js';

const FOODHALL4: ICafe = {
	name: 'Food Hall 4',
	id:   'foodhall4',
};

const run = async () => {
	console.log('Creating BuyOnDemand client for FH4...');
	const client = await BuyOnDemandClient.createAsync(FOODHALL4);
	console.log('Client created. Config:', JSON.stringify(client.config, null, 2));

	console.log('\nFetching station list...');
	const stations = await retrieveStationListAsync(client, 0);
	console.log(`Found ${stations.length} stations:`);
	for (const station of stations) {
		console.log(`  - ${station.name} (id: ${station.id}, menuId: ${station.menuId})`);
	}

	const papaya = stations.find(s => s.name.toLowerCase().includes('papaya'));
	if (!papaya) {
		console.error('Could not find Papaya Viet Kitchen station!');
		console.log('Available stations:', stations.map(s => s.name));
		return;
	}

	console.log(`\nFound station: ${papaya.name} (${papaya.id})`);
	const itemIds = Array.from(papaya.menuItemIdsByCategoryName.values()).flat();
	console.log(`Station has ${itemIds.length} items across ${papaya.menuItemIdsByCategoryName.size} categories`);

	for (const [categoryName, catItemIds] of papaya.menuItemIdsByCategoryName.entries()) {
		console.log(`  Category "${categoryName}": ${catItemIds.length} items`);
	}

	console.log('\nFetching menu items...');
	const menuItems = await retrieveMenuItemsAsync(client, papaya, itemIds);
	console.log(`Got ${menuItems.length} menu items from server`);

	// Find items with customization enabled
	const customizableItems = menuItems.filter(item => item.isItemCustomizationEnabled !== false);
	console.log(`${customizableItems.length} items have customization enabled`);

	// Fetch raw modifier details for each customizable item
	for (const item of customizableItems) {
		console.log(`\n--- Item: "${item.displayText}" (id: ${item.id}) ---`);
		console.log(`  isItemCustomizationEnabled: ${item.isItemCustomizationEnabled}`);

		try {
			const response = await client.requestAsync(
				`/sites/${client.config.tenantId}/${client.config.contextId}/kiosk-items/${item.id}`,
				{
					method: 'POST',
					body:   JSON.stringify({
						show86edModifiers: false,
						useIgPosApi:       false
					})
				},
				false /*shouldValidateSuccess*/
			);

			const rawJson = await response.json();
			const modifiersData = (rawJson as any)?.modifiers;

			if (!modifiersData?.modifiers || modifiersData.modifiers.length === 0) {
				console.log('  No modifiers found');
				continue;
			}

			console.log(`  Found ${modifiersData.modifiers.length} modifier group(s):`);
			for (const modifier of modifiersData.modifiers) {
				const isWeird = modifier.maximum === 0
					|| modifier.options?.length === 0
					|| modifier.maximum < modifier.minimum
					|| (modifier.options?.length ?? 0) < modifier.maximum;

				console.log(`\n  Modifier: "${modifier.description}" (id: ${modifier.id})`);
				console.log(`    type: ${modifier.type}`);
				console.log(`    minimum: ${modifier.minimum} (type: ${typeof modifier.minimum})`);
				console.log(`    maximum: ${modifier.maximum} (type: ${typeof modifier.maximum})`);
				console.log(`    options count: ${modifier.options?.length ?? 0}`);
				console.log(`    WEIRD: ${isWeird}`);

				// Log ALL raw fields on the modifier object to see if we're missing something
				console.log(`    ALL KEYS: ${Object.keys(modifier).join(', ')}`);
				// Log the raw modifier without options for brevity
				const { options, ...modifierWithoutOptions } = modifier;
				console.log(`    RAW (without options):`, JSON.stringify(modifierWithoutOptions, null, 4));

				if (modifier.options && modifier.options.length > 0) {
					console.log(`    Options:`);
					for (const option of modifier.options.slice(0, 5)) {
						console.log(`      - "${option.description}" (id: ${option.id}, amount: ${option.amount})`);
						console.log(`        ALL KEYS: ${Object.keys(option).join(', ')}`);
					}
					if (modifier.options.length > 5) {
						console.log(`      ... and ${modifier.options.length - 5} more`);
					}
				}
			}
		} catch (err) {
			console.error(`  Error fetching modifiers: ${err}`);
		}
	}
};

await run();
