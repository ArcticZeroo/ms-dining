import { BuyOnDemandClient, JSON_HEADERS } from './buy-ondemand-client.js';
import { ICafeStation } from '../../../models/cafe.js';
import { ICafeStationListItem } from '../../../models/buyondemand/responses.js';
import { isDuckTypeArray } from '@arcticzeroo/typeguard';

const convertBuyOnDemandStation = (client: BuyOnDemandClient, stationJson: ICafeStationListItem): ICafeStation  => {
	const station: ICafeStation = {
		id: stationJson.id,
		// Prioritize conceptOptions.displayText as it contains the correct display name for the station
		// (e.g. in some cases before we have seen "Masala Fresh" in conceptOptions.displayText which was
		// correct, while the name field was "What The Pho" which was incorrect).
		// Some station names are just a space, e.g. the station for the sandwich place in the commons
		// This is confusing for users in some cases, so let's just replace it with the cafe name
		name:                      stationJson.conceptOptions?.displayText?.trim() || stationJson.name.trim() || client.cafe.name,
		logoUrl:                   stationJson.image,
		menuId:                    stationJson.priceLevelConfig.menuId,
		menuLastUpdateTime:        new Date(0),
		menuItemIdsByCategoryName: new Map(),
		menuItemsById:             new Map()
	};

	const menu = stationJson.menus.find(menu => menu.id === station.menuId);

	if (menu == null) {
		throw new Error(`Unable to find menu with id ${station.menuId} in station ${station.name} (${station.id})`);
	}

	station.menuLastUpdateTime = new Date(menu.lastUpdateTime);

	const addItemsToCategory = (categoryName: string, itemsToAdd: string[]) => {
		const categoryItems = station.menuItemIdsByCategoryName.get(categoryName) ?? [];
		categoryItems.push(...itemsToAdd);
		station.menuItemIdsByCategoryName.set(categoryName, categoryItems);
	};

	for (const category of menu.categories) {
		if (category.items.length > 0) {
			addItemsToCategory(category.name, category.items);
		}

		// Some stations have subcategories, which we'll add as a separate category
		// e.g. "Sandwiches" + "Grilled" -> "Sandwiches - Grilled"
		// At the moment, we've only seen this in Beverages at Mila, where the
		// subcategory name was just a space, so in those cases we'll just append
		// to the parent category
		if (category.subCategories && category.subCategories.length > 0) {
			for (const subCategory of category.subCategories) {
				if (subCategory.items.length === 0) {
					continue;
				}

				const subCategoryName = subCategory.name.trim();
				const targetName = subCategoryName ? `${category.name} - ${subCategoryName}` : category.name;
				addItemsToCategory(targetName, subCategory.items);
			}
		}
	}

	return station;
}

export const retrieveStationListAsync = async (client: BuyOnDemandClient, daysInFuture: number): Promise<Array<ICafeStation>> => {
	const response = await client.requestAsync(
		`/sites/${client.config.tenantId}/${client.config.contextId}/concepts/${client.config.displayProfileId}`,
		{
			method:  'POST',
			headers: JSON_HEADERS,
			body:    JSON.stringify({
				isEasyMenuEnabled: false,
				// TODO: use schedule time discovered in config?
				scheduleTime: { startTime: '11:00 AM', endTime: '11:15 PM' },
				scheduledDay: daysInFuture,
				// storeInfo { some huge object }
			}),
		},
		false /*shouldValidateSuccess*/
	);

	if (response.status === 410) {
		// This cafe is not open today
		return [];
	}

	if (!response.ok) {
		throw new Error(`Unable to retrieve station list: ${response.status}`);
	}

	const json = await response.json();

	if (!isDuckTypeArray<ICafeStationListItem>(json, {
		id:    'string',
		name:  'string',
		menus: 'object'
	})) {
		throw new Error('Station list item is missing id/name/menus');
	}

	return json.map(stationJson => convertBuyOnDemandStation(client, stationJson));
}