import { isDuckType, isDuckTypeArray } from '@arcticzeroo/typeguard';
import fetch from 'node-fetch';
import { getBaseApiUrlWithoutTrailingSlash } from '../../constants/cafes.js';
import { requestRetryCount } from '../../constants/config.js';
import {
	ICafe,
	ICafeConfig,
	ICafeStation,
	IMenuItem,
	IMenuItemModifier,
	ModifierChoices,
	ModifierChoiceType
} from '../../models/cafe.js';
import {
	ICafeConfigResponse,
	ICafeMenuItemDetailsResponse,
	ICafeMenuItemListResponseItem,
	ICafeStationListItem
} from '../../models/responses.js';
import { logError, logInfo } from '../../util/log.js';
import { makeRequestWithRetries, validateSuccessResponse } from '../../util/request.js';
import { CafeStorageClient } from '../storage/cafe.js';

const getHeaders = (token: string) => token ? ({
	'Authorization': `Bearer ${token}`
}) : {};

const jsonHeaders = {
	'Content-Type': 'application/json'
};

export class CafeDiscoverySession {
	#token: string = '';
	public config: ICafeConfig | undefined;

	constructor(public readonly cafe: ICafe) {
	}

	private _getUrl(path: string) {
		return `${getBaseApiUrlWithoutTrailingSlash(this.cafe)}${path}`;
	}

	private _getRequestOptions(options: any = {}) {
		return {
			...options,
			headers: {
				...(options.headers ?? {}),
				...getHeaders(this.#token)
			}
		};
	}

	private async _requestAsync(path: string, options: any = {}) {
		const optionsWithToken = this._getRequestOptions(options);

		const url = this._getUrl(path);

		const response = await makeRequestWithRetries(
			(retry) => {
				logInfo(`${options.method ?? 'GET'} ${url} (Attempt ${retry})`);
				return fetch(url, optionsWithToken);
			},
			requestRetryCount
		);

		validateSuccessResponse(response);

		return response;
	}

	private async performLoginAsync() {
		const response = await this._requestAsync('/login/anonymous',
			{
				method: 'PUT'
			});

		if (!response.headers.has('access-token')) {
			throw new Error(`Access token is missing from headers. Available headers: ${Array.from(response.headers.keys()).join(', ')}`);
		}

		this.#token = response.headers.get('access-token');
	}

	private async retrieveConfigDataAsync() {
		try {
			const cafeFromDatabase = await CafeStorageClient.retrieveCafeAsync(this.cafe.id);
			if (cafeFromDatabase != null) {
				this.config = {
					tenantId:         cafeFromDatabase.tenantId,
					contextId:        cafeFromDatabase.contextId,
					logoName:         cafeFromDatabase.logoName,
					displayProfileId: cafeFromDatabase.displayProfileId
				};
				return;
			}
		} catch (err) {
			logError('Unable to retrieve cafe from database:', err);
		}

		const response = await this._requestAsync('/config');

		const json = await response.json();

		if (!isDuckType<ICafeConfigResponse>(json, {
			tenantID:  'string',
			contextID: 'string',
			theme:     'object',
			storeList: 'object'
		})) {
			throw new Error(`JSON is missing some data!`);
		}

		this.config = {
			tenantId:         json.tenantID,
			contextId:        json.contextID,
			logoName:         json.theme.logoImage,
			displayProfileId: json.storeList[0].displayProfileId[0]
		};

		try {
			await CafeStorageClient.createCafeAsync(this.cafe, this.config);
		} catch (err) {
			logError('Unable to save cafe to database:', err);
		}
	}

	private async retrieveStationListAsync(scheduledDay: number = 0): Promise<Array<ICafeStation>> {
		const response = await this._requestAsync(
			`/sites/${this.config.tenantId}/${this.config.contextId}/concepts/${this.config.displayProfileId}`,
			{
				method:  'POST',
				headers: jsonHeaders,
				body:    JSON.stringify({
					isEasyMenuEnabled: false,
					// TODO: use schedule time discovered in config?
					scheduleTime: { startTime: '11:00 AM', endTime: '11:15 PM' },
					scheduledDay: scheduledDay,
					// storeInfo { some huge object }
				})
			}
		);

		const json = await response.json();
		if (!isDuckTypeArray<ICafeStationListItem>(json, {
			id:    'string',
			name:  'string',
			menus: 'object'
		})) {
			throw new Error('Invalid object type');
		}

		const stations: ICafeStation[] = [];

		for (const stationJson of json) {
			const station: ICafeStation = {
				id:                        stationJson.id,
				name:                      stationJson.name,
				logoUrl:                   stationJson.image,
				menuId:                    stationJson.priceLevelConfig.menuId,
				menuItemIdsByCategoryName: new Map(),
				menuItemsById:             new Map()
			};

			for (const menu of stationJson.menus) {
				if (menu.id !== station.menuId) {
					continue;
				}

				for (const category of menu.categories) {
					station.menuItemIdsByCategoryName.set(category.name, category.items);
				}
			}

			stations.push(station);
		}

		return stations;
	}

	private _mapModifierChoiceType(jsonChoiceType: string): ModifierChoiceType {
		switch (jsonChoiceType) {
			case 'radio':
				return ModifierChoices.radio;
			case 'checkbox':
				return ModifierChoices.checkbox;
			default:
				return ModifierChoices.multiSelect;
		}
	}

	private _mapModifiersFromDetails(jsonItem: ICafeMenuItemDetailsResponse): Array<IMenuItemModifier> {
		return jsonItem.modifiers.modifiers.map(jsonModifier => ({
			id:          jsonModifier.id,
			description: jsonModifier.description,
			minimum:     jsonModifier.minimum,
			maximum:     jsonModifier.maximum,
			choiceType:  this._mapModifierChoiceType(jsonModifier.type),
			choices:     jsonModifier.options.map(jsonOption => ({
				id:          jsonOption.id,
				description: jsonOption.description,
				price:       jsonOption.amount
			}))
		}));
	}

	private async _retrieveModifierDetails(itemId: string): Promise<Array<IMenuItemModifier>> {
		const response = await this._requestAsync(`/sites/${this.config.tenantId}/${this.config.contextId}/kiosk-items/${itemId}`, {
			method: 'POST',
			body:   JSON.stringify({
				show86edModifiers: false,
				useIgPosApi:       false
			})
		});

		if (!response.ok) {
			throw new Error(`Unable to retrieve modifier details for item ${itemId}: ${response.status}`);
		}

		const json: ICafeMenuItemDetailsResponse = await response.json();

		if (json.modifiers?.modifiers == null) {
			return [];
		}

		return this._mapModifiersFromDetails(json);
	}

	private _shouldRetrieveModifierDetails(localItem: IMenuItem | undefined, jsonItem: ICafeMenuItemListResponseItem): boolean {
		if (localItem == null || localItem.lastUpdateTime == null || Number.isNaN(localItem.lastUpdateTime.getTime())) {
			return true;
		}

		const lastUpdateTime = new Date(jsonItem.lastUpdateTime);
		if (Number.isNaN(lastUpdateTime.getTime())) {
			return true;
		}

		return lastUpdateTime.getTime() > localItem.lastUpdateTime.getTime();
	}

	private async _retrieveMenuItemDetails(localItemsById: Map<string, IMenuItem>, jsonItem: ICafeMenuItemListResponseItem): Promise<IMenuItem> {
		console.log('Retrieving details for item id', jsonItem.id);
		const localItem = localItemsById.get(jsonItem.id);

		console.log('does local item exist?', localItem != null);

		let modifiers = localItem?.modifiers;
		if (this._shouldRetrieveModifierDetails(localItem, jsonItem)) {
			console.log('getting modifiers online...');
			try {
				modifiers = await this._retrieveModifierDetails(jsonItem.id);
			} catch (err) {
				logError(`Unable to retrieve modifier details for item ${jsonItem.id}:`, err);
			}
		}

		return {
			id:             jsonItem.id,
			price:          jsonItem.amount,
			name:           jsonItem.displayText,
			calories:       jsonItem.properties.calories,
			maxCalories:    jsonItem.properties.maxCalories,
			hasThumbnail:   jsonItem.image != null,
			imageUrl:       jsonItem.image,
			description:    jsonItem.description,
			modifiers:      modifiers,
			lastUpdateTime: new Date(jsonItem.lastUpdateTime)
		};
	}

	private async _doRetrieveMenuItemDetails(localItemsById: Map<string, IMenuItem>, stationId: string, menuId: string, itemIds: string[]): Promise<Array<IMenuItem>> {
		const response = await this._requestAsync(`/sites/${this.config.tenantId}/${this.config.contextId}/kiosk-items/get-items`,
			{
				method:  'POST',
				headers: jsonHeaders,
				body:    JSON.stringify({
					conceptId:          stationId,
					currencyUnit:       'USD',
					isCategoryHasItems: true,
					itemIds,
					menuPriceLevel:     {
						menuId
					},
					show86edItems:      false,
					useIgPosApi:        false
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

		const items: IMenuItem[] = [];

		// Don't fail to retrieve the whole menu item because some failed
		console.log('retrieving all details for', json.length, 'item(s)');
		const menuItemPromises = json.map(jsonItem => this._retrieveMenuItemDetails(localItemsById, jsonItem));
		for (const menuItemPromise of menuItemPromises) {
			try {
				console.log('awaiting menu item promise');
				const menuItem = await menuItemPromise;
				console.log('got menu item:', menuItem);
				items.push(menuItem);
			} catch (err) {
				logError('Unable to retrieve menu item:', err);
			}
		}

		return items;
	}

	private async retrieveMenuItemDetailsAsync(stationId: string, menuId: string, itemIds: string[], alwaysGetServerItems: boolean): Promise<Array<IMenuItem>> {
		const itemIdsToRetrieve = new Set(itemIds);
		const items: IMenuItem[] = [];
		const localItemsById = new Map<string, IMenuItem>();

		for (const itemId of itemIds) {
			const existingItem = await CafeStorageClient.retrieveMenuItemLocallyAsync(itemId);
			if (existingItem == null) {
				continue;
			}

			localItemsById.set(itemId, existingItem);

			if (!alwaysGetServerItems) {
				itemIdsToRetrieve.delete(itemId);
				items.push(existingItem);
			}
		}

		console.log('Retrieving data for', itemIds.length, 'item(s). There are', localItemsById.size, 'items stored locally from these ids, so we have to go online for', itemIdsToRetrieve.size, 'item(s)');

		// Side note: if we send a request with an empty list, we get EVERY item
		if (itemIdsToRetrieve.size > 0) {
			console.log('getting items online:', Array.from(itemIdsToRetrieve));
			const serverItems = await this._doRetrieveMenuItemDetails(localItemsById, stationId, menuId, Array.from(itemIdsToRetrieve));

			for (const item of serverItems) {
				console.log('resolved item:', item);

				items.push(item);

				try {
					await CafeStorageClient.createMenuItemAsync(item, true /*allowUpdateIfExisting*/);
				} catch (err) {
					logError(`Unable to save menu item "${item.name}"@${item.id} to the database:`, err);
				}
			}
		}

		return items;
	}

	private async _populateMenuItemsForStationAsync(station: ICafeStation, alwaysGetServerItems: boolean) {
		const itemIds = Array.from(station.menuItemIdsByCategoryName.values()).flat();
		const menuItems = await this.retrieveMenuItemDetailsAsync(station.id, station.menuId, itemIds, alwaysGetServerItems);
		for (const menuItem of menuItems) {
			station.menuItemsById.set(menuItem.id, menuItem);
		}
	}

	private async populateMenuItemsForAllStationsAsync(stations: ICafeStation[], alwaysGetServerItems: boolean) {
		for (const station of stations) {
			await this._populateMenuItemsForStationAsync(station, alwaysGetServerItems);
		}
	}

	public async populateMenuAsync(scheduledDay: number = 0): Promise<Array<ICafeStation>> {
		const stations = await this.retrieveStationListAsync(scheduledDay);
		await this.populateMenuItemsForAllStationsAsync(stations, scheduledDay === 0 /*alwaysGetServerItems*/);
		return stations;
	}

	public async initialize() {
		await this.performLoginAsync();
		await this.retrieveConfigDataAsync();
	}
}