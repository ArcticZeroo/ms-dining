import { isDuckType, isDuckTypeArray } from '@arcticzeroo/typeguard';
import fetch from 'node-fetch';
import { getBaseApiUrlWithoutTrailingSlash } from '../../constants/cafes.js';
import { requestRetryCount } from '../../constants/config.js';
import { defaultUserAgent } from '../../constants/http.js';
import { ICafe, ICafeConfig, ICafeStation, IMenuItem } from '../../models/cafe.js';
import { ICafeConfigResponse, ICafeMenuItemsResponseItem, ICafeStationListItem } from '../../models/responses.js';
import { makeRequestWithRetries, validateSuccessResponse } from '../../util/request.js';

const getHeaders = (token: string) => token ? ({
	'User-Agent':    defaultUserAgent,
	'Authorization': `Bearer ${token}`
}) : {};

const jsonHeaders = {
	'Content-Type': 'application/json'
};

export class CafeDiscoverySession {
	#token: string;
	public config: ICafeConfig;
	public readonly stations: ICafeStation[] = [];

	constructor(public readonly cafe: ICafe) {
	}

	get logoUrl() {
		return `${getBaseApiUrlWithoutTrailingSlash(this.cafe)}/image/${this.config.tenantId}/${this.config.contextId}/${this.config.logoName}`;
	}

	private _getUrl(path) {
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
				// logInfo(`${options.method ?? 'GET'} ${url} (Attempt ${retry})`);
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
	}

	private async retrieveConceptListAsync() {
		const response = await this._requestAsync(
			`/sites/${this.config.tenantId}/${this.config.contextId}/concepts/${this.config.displayProfileId}`,
			{
				method:  'POST',
				headers: jsonHeaders,
				body:    JSON.stringify({
					isEasyMenuEnabled: false,
					scheduleTime:      { startTime: '12:00 PM', endTime: '12:15 PM' },
					// TODO remove this!
					scheduledDay:      2,
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

		for (const conceptJson of json) {
			const conceptInfo: ICafeStation = {
				id:                        conceptJson.id,
				name:                      conceptJson.name,
				logoUrl:                   conceptJson.image,
				menuId:                    conceptJson.priceLevelConfig.menuId,
				menuItemIdsByCategoryName: new Map(),
				menuItemsById:             new Map()
			};

			for (const menu of conceptJson.menus) {
				if (menu.id !== conceptInfo.menuId) {
					continue;
				}

				for (const category of menu.categories) {
					conceptInfo.menuItemIdsByCategoryName.set(category.name, category.items);
				}
			}

			this.stations.push(conceptInfo);
		}
	}

	private async retrieveMenuItemDetailsAsync(conceptId: string, menuId: string, itemIds: string[]): Promise<Array<IMenuItem>> {
		const response = await this._requestAsync(`/sites/${this.config.tenantId}/${this.config.contextId}/kiosk-items/get-items`,
			{
				method:  'POST',
				headers: jsonHeaders,
				body:    JSON.stringify({
					conceptId,
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
		if (!isDuckTypeArray<ICafeMenuItemsResponseItem>(json, {
			id:          'string',
			amount:      'string',
			displayText: 'string',
			properties:  'object'
		})) {
			throw new Error('Invalid object type');
		}

		return json.map(jsonItem => ({
			id:           jsonItem.id,
			price:        jsonItem.amount,
			displayName:  jsonItem.displayText,
			calories:     jsonItem.properties.calories,
			maxCalories:  jsonItem.properties.maxCalories,
			description:  jsonItem.description,
			hasThumbnail: false,
			// Make sure to encode the URI, since the API can return un-encoded URIs that will throw 503s to azure
			imageUrl: jsonItem.image ? encodeURI(jsonItem.image) : undefined,
		}));
	}

	private async _populateMenuItemsForConceptAsync(concept: ICafeStation) {
		const itemIds = Array.from(concept.menuItemIdsByCategoryName.values()).flat();
		const menuItems = await this.retrieveMenuItemDetailsAsync(concept.id, concept.menuId, itemIds);
		for (const menuItem of menuItems) {
			concept.menuItemsById.set(menuItem.id, menuItem);
		}
	}

	private async populateMenuItemsForAllConceptsAsync() {
		for (const concept of this.stations) {
			await this._populateMenuItemsForConceptAsync(concept);
		}
	}

	public async performDiscoveryAsync() {
		await this.performLoginAsync();
		await this.retrieveConfigDataAsync();
		await this.retrieveConceptListAsync();
		await this.populateMenuItemsForAllConceptsAsync();
	}
}