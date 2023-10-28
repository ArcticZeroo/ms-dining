import { isDuckType, isDuckTypeArray } from '@arcticzeroo/typeguard';
import fetch from 'node-fetch';
import { getBaseApiUrlWithoutTrailingSlash } from '../../constants/cafes.js';
import { requestRetryCount } from '../../constants/config.js';
import { ICafe, ICafeConfig, ICafeStation, IMenuItem } from '../../models/cafe.js';
import { ICafeConfigResponse, ICafeMenuItemsResponseItem, ICafeStationListItem } from '../../models/responses.js';
import { makeRequestWithRetries, validateSuccessResponse } from '../../util/request.js';
import * as cafeStorage from '../storage/cafe.js';
import { logError, logInfo } from '../../util/log.js';

const getHeaders = (token: string) => token ? ({
    'Authorization': `Bearer ${token}`
}) : {};

const jsonHeaders = {
    'Content-Type': 'application/json'
};

interface ICafeDiscoverySessionParams {
    cafe: ICafe;
    scheduledDay: number;
}

export class CafeDiscoverySession {
    #token: string = '';
    public config: ICafeConfig | undefined;
    public readonly stations: ICafeStation[] = [];
    public readonly cafe: ICafe;
    public readonly scheduledDay: number;

    constructor({ cafe, scheduledDay }: ICafeDiscoverySessionParams) {
        this.cafe = cafe;
        this.scheduledDay = scheduledDay;
    }

    get dateString() {
        const now = new Date();
        now.setDate(now.getDate() + this.scheduledDay);
        return `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
    }

    get logoUrl() {
        if (!this.config?.logoName) {
            return undefined;
        }

        return `${getBaseApiUrlWithoutTrailingSlash(this.cafe)}/image/${this.config.tenantId}/${this.config.contextId}/${this.config.logoName}`;
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
        try {
            const cafeFromDatabase = await cafeStorage.getCafeByIdAsync(this.cafe.id);
            if (cafeFromDatabase != null) {
                logInfo('Got cafe from database, skipping config request');
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
            await cafeStorage.createCafeAsync({
                id:               this.cafe.id,
                name:             this.cafe.name,
                tenantId:         this.config.tenantId,
                contextId:        this.config.contextId,
                logoName:         this.config.logoName,
                displayProfileId: this.config.displayProfileId
            });
        } catch (err) {
            logError('Unable to save cafe to database:', err);
        }
    }

    private async retrieveStationListAsync() {
        const response = await this._requestAsync(
            `/sites/${this.config.tenantId}/${this.config.contextId}/concepts/${this.config.displayProfileId}`,
            {
                method:  'POST',
                headers: jsonHeaders,
                body:    JSON.stringify({
                    isEasyMenuEnabled: false,
                    // TODO: use schedule time discovered in config?
                    scheduleTime:      { startTime: '11:00 AM', endTime: '11:15 PM' },
                    scheduledDay:      this.scheduledDay,
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

            this.stations.push(station);
        }
    }

    private async retrieveMenuItemDetailsAsync(stationId: string, menuId: string, itemIds: string[]): Promise<Array<IMenuItem>> {
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

    private async _populateMenuItemsForStationAsync(station: ICafeStation) {
        const itemIds = Array.from(station.menuItemIdsByCategoryName.values()).flat();
        const menuItems = await this.retrieveMenuItemDetailsAsync(station.id, station.menuId, itemIds);
        for (const menuItem of menuItems) {
            station.menuItemsById.set(menuItem.id, menuItem);
        }
    }

    private async populateMenuItemsForAllStationsAsync() {
        for (const station of this.stations) {
            await this._populateMenuItemsForStationAsync(station);
        }
    }

    public async performDiscoveryAsync() {
        await this.performLoginAsync();
        await this.retrieveConfigDataAsync();
        await this.retrieveStationListAsync();
        await this.populateMenuItemsForAllStationsAsync();
    }
}