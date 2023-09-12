import {
    IDiningHall,
    IDiningHallConcept,
    IDiningHallConfig,
    IDiningHallMenuItem
} from '../../models/dining-hall.js';
import { getBaseApiUrlWithoutTrailingSlash } from '../../constants/dining-halls.js';
import fetch from 'node-fetch';
import { validateSuccessResponse } from '../../util/request.js';
import { isDiningHallConfigResponse } from '../../util/typeguard.js';
import { isDuckType, isDuckTypeArray } from '@arcticzeroo/typeguard';
import {
    IDiningHallConceptListItem,
    IDiningHallMenuItemsResponseItem,
    IDiningHallSitesByContextResponse
} from '../../models/responses.js';

const getHeaders = (token: string) => ({
    'Authorization': `Bearer ${token}`
})

export class DiningHallDiscoverySession {
    #token: string;
    public config: IDiningHallConfig;
    public readonly concepts: IDiningHallConcept[] = [];

    constructor(public readonly diningHall: IDiningHall) {
    }

    get logoUrl() {
        return `${getBaseApiUrlWithoutTrailingSlash(this.diningHall)}/image/${this.config.tenantId}/${this.config.contextId}/${this.config.logoName}`;
    }

    private _getUrl(path) {
        return `${getBaseApiUrlWithoutTrailingSlash(this.diningHall)}${path}`;
    }

    private async performLoginAsync() {
        const response = await fetch(this._getUrl(`/login/anonymous`),
            {
                method: 'POST'
            });

        validateSuccessResponse(response);

        if (!response.headers.has('access-token')) {
            throw new Error(`Access token is missing from headers. Available headers: ${Array.from(response.headers.keys()).join(', ')}`);
        }

        this.#token = response.headers.get('access-token');
    }

    private async retrieveConfigDataAsync() {
        const response = await fetch(`${getBaseApiUrlWithoutTrailingSlash(this.diningHall)}/config`,
            {
                headers: getHeaders(this.#token)
            });

        validateSuccessResponse(response);

        const json = await response.json();

        if (!isDiningHallConfigResponse(json)) {
            throw new Error(`JSON is missing some data!`);
        }

        this.config = {
            tenantId:         json.tenantId,
            contextId:        json.contextId,
            logoName:         json.theme.logoImage,
            displayProfileId: json.storeList[0].displayProfileId[0]
        };
    }

    private async retrieveConceptListAsync() {
        const response = await fetch(
            `${getBaseApiUrlWithoutTrailingSlash(this.diningHall)}/sites/${this.config.contextId}/concepts/${this.config.displayProfileId}`,
            {
                method:  'POST',
                headers: getHeaders(this.#token),
                body:    JSON.stringify({
                    isEasyMenuEnabled: false,
                    scheduleTime:      { startTime: '1:45 PM', endTime: '2:00 PM' },
                    scheduledDay:      0,
                    // storeInfo { some huge object }
                })
            }
        );

        validateSuccessResponse(response);

        const json = await response.json();
        if (!isDuckTypeArray<IDiningHallConceptListItem>(json, {
            id:    'string',
            image: 'string',
            name:  'string',
            menus: 'object'
        })) {
            throw new Error('Invalid object type');
        }

        for (const conceptJson of json) {
            const conceptInfo: IDiningHallConcept = {
                id:                    conceptJson.id,
                name:                  conceptJson.name,
                logoUrl:               conceptJson.image,
                menuId:                conceptJson.priceLevelConfig.menuId,
                menuItemIdsByCategory: new Map(),
                menuItemsById:         new Map()
            };

            for (const menu of conceptJson.menus) {
                if (menu.id !== conceptInfo.menuId) {
                    continue;
                }

                for (const category of menu.categories) {
                    conceptInfo.menuItemIdsByCategory.set(category.name, category.items);
                }
            }

            this.concepts.push(conceptInfo);
        }
    }

    private async retrieveMenuItemDetailsAsync(conceptId: string, menuId: string, itemIds: string[]): Promise<Array<IDiningHallMenuItem>> {
        const response = await fetch(
            `${getBaseApiUrlWithoutTrailingSlash(this.diningHall)}/sites/${this.config.tenantId}/${this.config.contextId}/kiosk-items/get-items`,
            {
                method:  'POST',
                headers: getHeaders(this.#token),
                body:    JSON.stringify({
                    conceptId,
                    itemIds,
                    currencyUnit:       'USD',
                    isCategoryHasItems: true,
                    menuPriceLevel:     {
                        menuId
                    },
                    show86edItems:      false,
                    useIgPosApi:        false
                })
            }
        );

        validateSuccessResponse(response);

        const json = await response.json();
        if (!isDuckTypeArray<IDiningHallMenuItemsResponseItem>(json, {
            id:          'string',
            amount:      'string',
            displayText: 'string',
            properties:  'object'
        })) {
            throw new Error('Invalid object type');
        }

        return json.map(jsonItem => ({
            id:          jsonItem.id,
            price:       jsonItem.amount,
            displayName: jsonItem.displayText,
            calories:    jsonItem.properties.calories,
            maxCalories: jsonItem.properties.maxCalories
        }));
    }

    private async _populateMenuItemsForConceptAsync(concept: IDiningHallConcept) {
        const itemIds = Array.from(concept.menuItemIdsByCategory.values()).flat();
        const menuItems = await this.retrieveMenuItemDetailsAsync(concept.id, concept.menuId, itemIds);
        for (const menuItem of menuItems) {
            concept.menuItemsById.set(menuItem.id, menuItem);
        }
    }

    private async populateMenuItemsForAllConceptsAsync() {
        await Promise.all(this.concepts.map(concept => this._populateMenuItemsForConceptAsync(concept)));
    }

    public async performDiscoveryAsync() {
        await this.performLoginAsync();
        await this.retrieveConfigDataAsync();
        await this.retrieveConceptListAsync();
        await this.populateMenuItemsForAllConceptsAsync();
    }
}