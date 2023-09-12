import { IDiningHall, IDiningHallConceptHeader, IDiningHallConfig } from '../../models/dining-hall.js';
import { getBaseApiUrlWithoutTrailingSlash } from '../../constants/dining-halls.js';
import fetch from 'node-fetch';
import { validateSuccessResponse } from '../../util/request.js';
import { isDiningHallConfigResponse } from '../../util/typeguard.js';
import { isDuckType, isDuckTypeArray } from '@arcticzeroo/typeguard';
import { IDiningHallConceptListItem, IDiningHallSitesByContextResponse } from '../../models/responses.js';

const getHeaders = (token: string) => ({
    'Authorization': `Bearer ${token}`
})

class DiningHallDiscoverySession {
    private _token: string;
    private _config: IDiningHallConfig;
    private readonly _conceptHeaders: IDiningHallConceptHeader[] = [];

    constructor(public readonly diningHall: IDiningHall) {
    }

    get logoUrl() {
        return `${getBaseApiUrlWithoutTrailingSlash(this.diningHall)}/image/${this._config.tenantId}/${this._config.contextId}/${this._config.logoName}`;
    }

    private _getUrl(path) {
        return `${getBaseApiUrlWithoutTrailingSlash(this.diningHall)}${path}`;
    }

    async performLoginAsync() {
        const response = await fetch(this._getUrl(`/login/anonymous`),
            {
                method: 'POST'
            });

        validateSuccessResponse(response);

        if (!response.headers.has('access-token')) {
            throw new Error(`Access token is missing from headers. Available headers: ${Array.from(response.headers.keys()).join(', ')}`);
        }

        this._token = response.headers.get('access-token');
    }

    async retrieveConfigDataAsync() {
        const response = await fetch(`${getBaseApiUrlWithoutTrailingSlash(this.diningHall)}/config`,
            {
                headers: getHeaders(this._token)
            });

        validateSuccessResponse(response);

        const json = await response.json();

        if (!isDiningHallConfigResponse(json)) {
            throw new Error(`JSON is missing some data!`);
        }

        this._config = {
            tenantId: json.tenantId,
            contextId: json.contextId,
            logoName: json.theme.logoImage,
            displayProfileId: json.storeList[0].displayProfileId[0]
        };
    }

    async retrieveConceptListAsync() {
        const response = await fetch(
            `${getBaseApiUrlWithoutTrailingSlash(this.diningHall)}/sites/${this._config.contextId}/concepts/${this._config.displayProfileId}`,
            {
                method: 'POST',
                headers: getHeaders(this._token),
                body: JSON.stringify({
                    isEasyMenuEnabled: false,
                    scheduleTime: { startTime: '12:45 PM', endTime: '1:00 PM' },
                    scheduledDay: 0,
                    // storeInfo { some huge object }
                })
            }
        );

        validateSuccessResponse(response);

        const json = await response.json();
        if (!isDuckTypeArray<IDiningHallConceptListItem>(json, {
            id: 'string',
            image: 'string',
            name: 'string',
            menus: 'object'
        })) {
            throw new Error('Invalid object type');
        }

        for (const conceptJson of json) {
            const conceptInfo: IDiningHallConceptHeader = {
                name: conceptJson.name,
                logoUrl: conceptJson.image,
                menuItemsByCategory: new Map()
            };

            const activeMenuId = conceptJson.priceLevelConfig.menuId;

            for (const menu of conceptJson.menus) {
                if (menu.id !== activeMenuId) {
                    continue;
                }

                conceptInfo.
            }
        }
    }

    async performDiscoveryAsync() {
        await this.performLoginAsync();
        await this.retrieveConfigDataAsync();

    }
}

const retrieveConceptListAsync = async (diningHall: IDiningHall, config: IDiningHallConfig, token: string) => {
}

export const retrieveMenuData = async (diningHall: IDiningHall) => {

}