import { isDuckType } from '@arcticzeroo/typeguard';
import fetch from 'node-fetch';
import { getBaseApiUrlWithoutTrailingSlash } from '../../../constants/cafes.js';
import { ICafe, ICafeConfig } from '../../../models/cafe.js';
import { ICafeConfigResponse } from '../../../models/buyondemand/responses.js';
import { ENVIRONMENT_SETTINGS } from '../../../util/env.js';
import { logDebug, logError } from '../../../util/log.js';
import { captureFetchAsHarEntry, HarCapture } from '../../../util/har.js';
import { isResponseServerError, makeRequestWithRetries, validateSuccessResponse } from '../../../util/request.js';
import { Semaphore } from '@frozor/lock';
import { CafeStorageClient } from '../../storage/clients/cafe.js';
import { StringUtil } from '../../../util/string.js';
import { TELEMETRY_CLIENT } from '../../telemetry/app-insights.js';
import hat from 'hat';

const REQUEST_SEMAPHORE = new Semaphore(ENVIRONMENT_SETTINGS.maxConcurrentRequests);

// Per-request timeout so a hanging upstream never blocks us forever.
const REQUEST_TIMEOUT_MS = 30_000;

const getHeaders = (token: string, csrfToken: string) => token ? ({
    'Authorization': `Bearer ${token}`,
    'User-Agent':    'PostmanRuntime/7.36.0',
    'Csrf-Token':    csrfToken,
    'Cookie':        `csrf-token=${csrfToken}`
}) : {};

export const JSON_HEADERS = {
    'Content-Type': 'application/json'
};

export class BuyOnDemandClient {
    #token: string = '';
    #csrfToken: string = '';
    #harCapture: HarCapture | null = null;

    // will always be set to non-empty value after initialization
    // ...this is just easier than extracting request logic to a separate class
    public config: ICafeConfig = {
        tenantId:         '',
        contextId:        '',
        logoName:         '',
        displayProfileId: '',
        storeId:          '',
        externalName:     '',
        isShutDown:       false,
        shutDownMessage:  undefined,
    };

    private constructor(public readonly cafe: ICafe) {
    }

    public static async createAsync(cafe: ICafe, enableHar: boolean = false): Promise<BuyOnDemandClient> {
        const client = new BuyOnDemandClient(cafe);
        if (enableHar) {
            client.enableHarCapture();
        }
        await client.#performLoginAsync();
        await client.#retrieveConfigDataAsync();
        return client;
    }

    public async refreshLogin(): Promise<void> {
        await this.#performLoginAsync();
    }

    public enableHarCapture(): HarCapture {
        this.#harCapture = new HarCapture();
        return this.#harCapture;
    }

    public get harCapture(): HarCapture | null {
        return this.#harCapture;
    }

    protected _getUrl(path: string) {
        return `${getBaseApiUrlWithoutTrailingSlash(this.cafe)}${path}`;
    }

    protected _getRequestOptions(options: any = {}) {
        return {
            ...options,
            headers: {
                ...(options.headers ?? {}),
                ...getHeaders(this.#token, this.#csrfToken)
            }
        };
    }

    public async requestAsync(path: string, options: any = {}, shouldValidateSuccess: boolean = true) {
        return REQUEST_SEMAPHORE.acquire(async () => {
            const id = hat();

            const optionsWithToken = this._getRequestOptions(options);

            const url = this._getUrl(path);

            const startMs = Date.now();
            let lastRetry = 0;
            const response = await makeRequestWithRetries(
                {
                    makeRequest: (retry) => {
                        lastRetry = retry;
                        if (ENVIRONMENT_SETTINGS.logRequests) {
                            logDebug(`${id} ${options.method ?? 'GET'} ${url} (Attempt ${retry})`);
                            logDebug(`${id} Headers:`, optionsWithToken.headers);
                            logDebug(`${id} Body:`, optionsWithToken.body);
                        }
                        return fetch(url, {
                            ...optionsWithToken,
                            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
                        });
                    },
                    retryCount:  ENVIRONMENT_SETTINGS.requestRetryCount,
                    shouldRetry: (response) => !isResponseServerError(response)
                }
            );
            const durationMs = Date.now() - startMs;

            TELEMETRY_CLIENT?.trackDependency({
                dependencyTypeName: 'BuyOnDemand',
                name:               `${options.method ?? 'GET'} ${path}`,
                data:               url,
                target:             new URL(url).host,
                duration:           durationMs,
                resultCode:         String(response.status),
                success:            response.ok,
                properties: {
                    cafeId:     this.cafe.id,
                    retryCount: String(lastRetry),
                },
            });

            if (ENVIRONMENT_SETTINGS.logRequests) {
                logDebug(`${id} Response ${response.status} ${response.statusText}`);
            }

            if (this.#harCapture != null) {
                const entry = await captureFetchAsHarEntry(url, optionsWithToken, response);
                this.#harCapture.addEntry(entry);
            }

            if (shouldValidateSuccess) {
                validateSuccessResponse(response);
            }

            return response;
        });
    }

    async #performLoginAsync() {
        const response = await this.requestAsync('/login/anonymous',
            {
                method: 'GET'
            });

        if (!response.headers.has('access-token')) {
            throw new Error(`Access token is missing from headers. Available headers: ${Array.from(response.headers.keys()).join(', ')}`);
        }

        this.#token = response.headers.get('access-token')!;

        const body = await response.json();
        if (!isDuckType<{ csrfToken: string }>(body, { csrfToken: 'string' })) {
            throw new Error(`Login body is missing csrfToken`);
        }

        this.#csrfToken = body.csrfToken;
    }

    async #retrieveConfigDataAsync() {
        // Always try to fetch config from the API first so we get fresh
        // applicationShutOffConfig state. Fall back to DB if the API fails.
        try {
            const response = await this.requestAsync('/config');

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

            const shutOffConfig = json.properties?.applicationShutOffConfig;

            this.config = {
                tenantId:        json.tenantID,
                contextId:       json.contextID,
                logoName:        json.theme.logoImage,
                storeId:         store.storeInfo.storeInfoId,
                externalName:    store.storeInfo.storeName,
                isShutDown:      shutOffConfig?.isShutOffEnabled ?? false,
                shutDownMessage: shutOffConfig?.isShutOffEnabled ? shutOffConfig.instructionText : undefined,
                displayProfileId
            };

            try {
                await CafeStorageClient.createCafeAsync(this.cafe, this.config);
            } catch (err) {
                logError('Unable to save cafe to database:', err);
            }

            return;
        } catch (err) {
            logError(`Unable to fetch config from API for ${this.cafe.id}, falling back to database:`, err);
        }

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
                    externalName:     cafeFromDatabase.externalName,
                    isShutDown:       false,
                    shutDownMessage:  undefined,
                };
                return;
            }
        } catch (err) {
            logError('Unable to retrieve cafe from database:', err);
        }

        throw new Error(`Unable to retrieve config for ${this.cafe.id} from API or database`);
    }
}