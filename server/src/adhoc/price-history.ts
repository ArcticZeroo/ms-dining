import { CafeMenuSession } from '../api/cafe/session/menu.js';
import { ICafe } from '../models/cafe.js';
import { usePrismaClient } from '../api/storage/client.js';
import { cafeList } from '../constants/cafes.js';
import * as fs from 'node:fs/promises';
import { JSON_HEADERS } from '../api/cafe/session/discovery.js';
import { isDuckTypeArray } from '@arcticzeroo/typeguard';
import { ICafeMenuItemListResponseItem } from '../models/buyondemand/responses.js';

const OUTPUT_FILE_NAME = 'price-history.csv';

const PRICE_YEAR_BY_LEVEL = {
	'70': 2019,
	'71': 2023,
	'87': 2024
} as const;

const PRICE_LEVEL_BY_YEAR = {
	2019: '70',
	2023: '71',
	2024: '87'
} as const;

type PricesByLevel = Record<string, number>;
type MenuItemPriceMap = Map<string /*menuItemName*/, PricesByLevel>;

type ItemsByStationMap = Map<string /*stationId*/, Set<string /*menuItemId*/>>;
type AllCafeItemsByStationMap = Map<string /*cafeId*/, ItemsByStationMap>;

type CafeItemPriceMap = Map<string /*stationName*/, MenuItemPriceMap>;

const retrieveAllMenuItemIdsAsync = async (): Promise<AllCafeItemsByStationMap> => {
	const allMenus = await usePrismaClient(prismaClient => prismaClient.dailyStation.findMany({
		select: {
			cafeId:     true,
			dateString: true,
			stationId:  true,
			station:    {
				select: {
					name:    true,
					logoUrl: true,
					menuId:  true
				}
			},
			categories: {
				select: {
					name:      true,
					menuItems: {
						select: {
							menuItemId: true,
							menuItem:   {
								select: {
									tags:       true,
									searchTags: {
										select: {
											name: true
										}
									}
								}
							}
						},
					}
				}
			},
		}
	}));

	const items = new Map<string /*cafeId*/, Map<string /*stationId*/, Set<string>>>();
	for (const menu of allMenus) {
		if (!items.has(menu.cafeId)) {
			items.set(menu.cafeId, new Map());
		}

		const cafeItems = items.get(menu.cafeId)!;

		if (!cafeItems.has(menu.stationId)) {
			cafeItems.set(menu.stationId, new Set());
		}

		const stationItems = cafeItems.get(menu.stationId)!;

		for (const category of menu.categories) {
			for (const item of category.menuItems) {
				stationItems.add(item.menuItemId);
			}
		}
	}

	return items;
}

const retrieveAllStationNamesById = async (): Promise<Map<string, string>> => {
	const allStations = await usePrismaClient(prismaClient => prismaClient.station.findMany({
		select: {
			id:   true,
			name: true
		}
	}));

	const stationNamesById = new Map<string, string>();
	for (const station of allStations) {
		stationNamesById.set(station.id, station.name);
	}

	return stationNamesById;
}

class CafePriceHistorySession extends CafeMenuSession {
	constructor(cafe: ICafe) {
		super(cafe);
	}

	async _hackyRetrieveMenuItemDetailsForStation(stationId: string, stationMenuId: string, itemIds: string[]) {
		if (!this.config) {
			throw new Error('Config is required to retrieve menu item details!');
		}

		const response = await this._requestAsync(`/sites/${this.config.tenantId}/${this.config.contextId}/kiosk-items/get-items`,
			{
				method:  'POST',
				headers: JSON_HEADERS,
				body:    JSON.stringify({
					conceptId:          stationId,
					currencyUnit:       'USD',
					isCategoryHasItems: true,
					menuPriceLevel:     {
						menuId: stationMenuId
					},
					show86edItems:      false,
					useIgPosApi:        false,
					itemIds,
				})
			}
		);

		const json = await response.json();
		if (!isDuckTypeArray<ICafeMenuItemListResponseItem>(json, {
			id:          'string',
			amount:      'string',
			displayText: 'string',
			properties:  'object'
		})) {
			throw new Error('Invalid object type');
		}

		return json;
	}

	async retrieveStationItemPricesAsync(stationId: string, stationMenuId: string, itemIds: Set<string>): Promise<MenuItemPriceMap> {
		if (itemIds.size === 0) {
			console.warn(`[${this.cafe.name}] Station ${stationId} has no items to retrieve`);
			return new Map();
		}

		const priceDataByItemId = new Map<string, PricesByLevel>();

		const serverItems = await this._hackyRetrieveMenuItemDetailsForStation(stationId, stationMenuId, Array.from(itemIds));
		for (const serverItem of serverItems) {
			const pricesByLevel: PricesByLevel = {};

			for (const priceLevelId of Object.keys(PRICE_YEAR_BY_LEVEL)) {
				const price = serverItem.priceLevels[priceLevelId]?.price?.amount;
				if (price != null) {
					pricesByLevel[priceLevelId] = Number(price);
				}
			}

			priceDataByItemId.set(serverItem.displayText, pricesByLevel);
		}

		return priceDataByItemId;
	}

	async retrieveMenuPricesAsync(itemsByStationId: ItemsByStationMap): Promise<CafeItemPriceMap> {
		const stations = await this.retrieveStationListAsync();
		const menuId = stations[0]?.menuId;

		if (!menuId) {
			console.warn(`Unable to find menu ID for stations in cafe ${this.cafe.name}`);
			return new Map();
		}

		const priceDataByStationId = new Map<string, MenuItemPriceMap>();

		const promises = Array.from(itemsByStationId.entries()).map(async ([stationId, items]) => {
			const priceDataByItemId = await this.retrieveStationItemPricesAsync(stationId, menuId, items);
			priceDataByStationId.set(stationId, priceDataByItemId);
		});

		await Promise.all(promises);

		return priceDataByStationId;
	}
}

const retrievePriceHistoryForCafeAsync = async (allCafeItems: AllCafeItemsByStationMap, cafe: ICafe): Promise<CafeItemPriceMap> => {
	const itemsByStation = allCafeItems.get(cafe.id);

	if (!itemsByStation) {
		return new Map();
	}

	const session = new CafePriceHistorySession(cafe);
	await session.initialize();

	return await session.retrieveMenuPricesAsync(itemsByStation);
}

const retrievePriceHistoryForAllCafesAsync = async (): Promise<Map<string /*cafeId*/, CafeItemPriceMap>> => {
	console.log('Retrieving all menu item IDs...');
	const allCafeItems = await retrieveAllMenuItemIdsAsync();

	console.log('Finding price history for each cafe...');
	const cafePriceHistoryById = new Map<string, CafeItemPriceMap>();

	const promises = cafeList.map(async (cafe) => {
		cafePriceHistoryById.set(cafe.id, await retrievePriceHistoryForCafeAsync(allCafeItems, cafe));
	});

	await Promise.all(promises);

	return cafePriceHistoryById;
}

const createPriceHistoryOutput = async () => {
	console.log('Retrieving price history...');
	const priceHistory = await retrievePriceHistoryForAllCafesAsync();

	console.log('Retrieving station names...');
	const stationNamesById = await retrieveAllStationNamesById();

	const output = ['Cafe,Station,Item,2024 Price,2023 Price,2019 Price'];
	for (const cafe of cafeList) {
		const cafePriceHistory = priceHistory.get(cafe.id);

		if (!cafePriceHistory) {
			console.warn(`Unable to find price history for cafe ${cafe.name}`);
			continue;
		}

		for (const [stationId, itemPrices] of cafePriceHistory) {
			const stationName = stationNamesById.get(stationId);
			if (!stationName) {
				console.warn(`Unable to find station name for station ID ${stationId}`);
				continue;
			}

			for (const [item, prices] of itemPrices) {
				const price2024 = prices[PRICE_LEVEL_BY_YEAR[2024]];
				const price2023 = prices[PRICE_LEVEL_BY_YEAR[2023]];
				const price2019 = prices[PRICE_LEVEL_BY_YEAR[2019]];

				if (!price2024 || !price2023 || !price2019) {
					continue;
				}

				output.push(`${cafe.name},${stationName},${item.replaceAll(/,/g, '')},${price2024},${price2023},${price2019}`);
			}
		}
	}

	console.log('Writing output to file...');
	await fs.writeFile(OUTPUT_FILE_NAME, output.join('\n'));
}

await createPriceHistoryOutput();