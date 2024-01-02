import { isDuckType } from '@arcticzeroo/typeguard';
import fetch from 'node-fetch';
import { getBaseApiUrlWithoutTrailingSlash } from '../../../constants/cafes.js';
import { requestRetryCount } from '../../../constants/config.js';
import { ICafe, ICafeConfig } from '../../../models/cafe.js';
import { ICafeConfigResponse } from '../../../models/buyondemand/responses.js';
import { ENVIRONMENT_SETTINGS } from '../../../util/env.js';
import { logDebug, logError } from '../../../util/log.js';
import { isResponseServerError, makeRequestWithRetries, validateSuccessResponse } from '../../../util/request.js';
import Semaphore from 'semaphore-async-await';
import { CafeStorageClient } from '../../storage/clients/cafe.js';
import { StringUtil } from '../../../util/string.js';

const requestSemaphore = ENVIRONMENT_SETTINGS.maxConcurrentRequests
    ? new Semaphore.default(ENVIRONMENT_SETTINGS.maxConcurrentRequests)
    : null;

const getHeaders = (token: string) => token ? ({
    'Authorization': `Bearer ${token}`,
    'User-Agent':    'PostmanRuntime/7.36.0'
}) : {};

export const JSON_HEADERS = {
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

    protected async _requestAsync(path: string, options: any = {}, shouldValidateSuccess: boolean = true) {
        try {
            await requestSemaphore?.acquire();

            const optionsWithToken = this._getRequestOptions(options);

            const url = this._getUrl(path);

            const response = await makeRequestWithRetries(
                {
                    makeRequest: (retry) => {
                        logDebug(`${options.method ?? 'GET'} ${url} (Attempt ${retry})`);
                        return fetch(url, optionsWithToken);
                    },
                    retryCount:  requestRetryCount,
                    shouldRetry: (response) => !isResponseServerError(response)
                }
            );

            if (shouldValidateSuccess) {
                validateSuccessResponse(response);
            }

            return response;
        } finally {
            requestSemaphore?.release();
        }
    }

    private async performLoginAsync() {
        const response = await this._requestAsync('/login/anonymous',
            {
                method: 'PUT'
            });

        if (!response.headers.has('access-token')) {
            throw new Error(`Access token is missing from headers. Available headers: ${Array.from(response.headers.keys()).join(', ')}`);
        }

        this.#token = response.headers.get('access-token')!;
    }

    private async retrieveConfigDataAsync() {
        try {
            const cafeFromDatabase = await CafeStorageClient.retrieveCafeAsync(this.cafe.id);
            if (cafeFromDatabase != null
                && !StringUtil.isNullOrWhitespace(cafeFromDatabase.storeId)
                && !StringUtil.isNullOrWhitespace(cafeFromDatabase.externalName)) {
                this.config = {
                    tenantId:         cafeFromDatabase.tenantId,
                    contextId:        cafeFromDatabase.contextId,
                    logoName:         cafeFromDatabase.logoName,
                    displayProfileId: cafeFromDatabase.displayProfileId,
                    storeId:          cafeFromDatabase.storeId,
                    externalName:     cafeFromDatabase.externalName
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

        const [store] = json.storeList;

        if (store == null) {
            throw new Error('Store list is empty!');
        }

        const [displayProfileId] = store.displayProfileId;

        if (!displayProfileId) {
            throw new Error('Display profile ID is missing/empty!');
        }

        this.config = {
            tenantId:     json.tenantID,
            contextId:    json.contextID,
            logoName:     json.theme.logoImage,
            storeId:      store.storeInfo.storeInfoId,
            externalName: store.storeInfo.storeName,
            displayProfileId
        };

        try {
            await CafeStorageClient.createCafeAsync(this.cafe, this.config);
        } catch (err) {
            logError('Unable to save cafe to database:', err);
        }
    }

    public async initialize() {
        await this.performLoginAsync();
        await this.retrieveConfigDataAsync();
    }
}