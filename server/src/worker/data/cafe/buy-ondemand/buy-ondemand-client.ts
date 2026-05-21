import { isDuckType } from '@arcticzeroo/typeguard';
import fetch, { Response } from 'node-fetch';
import { getBaseApiUrlWithoutTrailingSlash } from '../../../../shared/constants/cafes.js';
import { ICafe, ICafeConfig } from '../../../../shared/models/cafe.js';
import { ICafeConfigResponse } from '../../../../shared/models/buyondemand/responses.js';
import { ENVIRONMENT_SETTINGS } from '../../../../shared/util/env.js';
import { logDebug, logError } from '../../../../shared/util/log.js';
import { buildHarEntry, HarCapture } from '../../../../shared/util/har.js';
import { isResponseServerError, makeRequestWithRetries, validateSuccessResponse } from '../../../../shared/util/request.js';
import { Semaphore } from '@frozor/lock';
import { getServices } from '../../../../main/services/registry.js';
import { StringUtil } from '../../../../shared/util/string.js';
import hat from 'hat';
import { maybeThrowBuyOnDemandError } from './buy-ondemand-error.js';

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

/**
 * Default schedule time window sent with BuyOnDemand concept/profile endpoints.
 * The API requires this field on all POST requests that include scheduledDay.
 */
export const DEFAULT_SCHEDULE_TIME = { startTime: '11:00 AM', endTime: '11:15 PM' } as const;

export interface BuyOnDemandClientOptions {
    /** Capture every request/response into a HAR file (written on `harCapture.writeToFile`). */
    enableHar?: boolean;
    /**
     * On failed BoD responses with a `{ message: <code> }` body, translate the
     * code via the locale-aware i18n cache and throw a `BuyOnDemandError`
     * carrying the user-facing message. When false (the default), failures
     * still throw, but as the legacy generic `"Response failed with status: X"`.
     */
    translateErrors?: boolean;
}

export class BuyOnDemandClient {
    #token: string = '';
    #csrfToken: string = '';
    #harCapture: HarCapture | null = null;
    #translateErrors: boolean = false;

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

    protected constructor(public readonly cafe: ICafe, options: BuyOnDemandClientOptions = {}) {
		if (options.enableHar) {
			this.enableHarCapture();
		}
		this.#translateErrors = options.translateErrors ?? false;
    }

    /**
     * Build a real BuyOnDemandClient: construct + perform anonymous login +
     * fetch /config. This is the production builder, wired into the services
     * bag at `services/production.ts`.
     *
     * Most callers should NOT invoke this directly — call
     * `createBuyOnDemandClient(cafe, opts)` from `services/registry.js` instead
     * so test code can substitute a TestBuyOnDemandClient backed by the
     * in-memory test server. The only legitimate direct callers are
     * `services/production.ts` (composition root) and adhoc scripts that
     * intentionally bypass the services bag.
     */
    public static async createAsync(cafe: ICafe, options: BuyOnDemandClientOptions = {}): Promise<BuyOnDemandClient> {
        const client = new BuyOnDemandClient(cafe, options);
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

            getServices().telemetry?.trackDependency({
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
                    // v3 SDK bug: resultCode is always 0 in Kusto, so duplicate here
                    statusCode: String(response.status),
                },
            });

            if (ENVIRONMENT_SETTINGS.logRequests) {
                logDebug(`${id} Response ${response.status} ${response.statusText}`);
            }

            // Read body once if anyone downstream (HAR capture or
            // translate-errors validation) will need it. Returning a fresh
            // Response below lets callers still call .json()/.text().
            const needsBodyForHar = this.#harCapture != null;
            const needsBodyForValidation = shouldValidateSuccess && !response.ok && this.#translateErrors;
            const needsBodyRead = needsBodyForHar || needsBodyForValidation;

            const bodyText = needsBodyRead ? await response.text() : undefined;

            if (this.#harCapture != null) {
                const entry = buildHarEntry(url, optionsWithToken, {
                    status:      response.status,
                    statusText:  response.statusText,
                    headers:     response.headers.entries(),
                    contentType: response.headers.get('content-type') ?? undefined,
                }, bodyText!);
                this.#harCapture.addEntry(entry);
            }

            await this._validateResponse(response, path, shouldValidateSuccess, bodyText);

            if (bodyText != null) {
                return new Response(bodyText, {
                    status:     response.status,
                    statusText: response.statusText,
                    headers:    Object.fromEntries(response.headers.entries()),
                });
            }

            return response;
        });
    }

    /**
     * Shared response validation hook used by both this class and
     * TestBuyOnDemandClient. Reads the body once (if needed for translation)
     * and either:
     *  - returns silently (response.ok or shouldValidateSuccess=false)
     *  - throws BuyOnDemandError for translatable BoD error bodies
     *  - throws a generic Error (with body for debugging) otherwise.
     */
    protected async _validateResponse(
        response: Response,
        path: string,
        shouldValidateSuccess: boolean,
        bodyText?: string,
    ): Promise<void> {
        if (!shouldValidateSuccess || response.ok) {
            return;
        }

        if (this.#translateErrors) {
            const text = bodyText ?? await response.text();
            await maybeThrowBuyOnDemandError(this, response.status, text);
            throw new Error(
                `{${this.cafe.name}} BoD request to ${path} failed (${response.status}): ${text}`,
            );
        }

        validateSuccessResponse(response);
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
                displayProfileId,
                storeInfo:       store.storeInfo as Record<string, unknown>,
            };

            try {
                await getServices().data.cafe.createCafe({ cafe: this.cafe, config: this.config });
            } catch (err) {
                logError('Unable to save cafe to database:', err);
            }

            return;
        } catch (err) {
            logError(`Unable to fetch config from API for ${this.cafe.id}, falling back to database:`, err);
        }

        try {
            const cafeFromDatabase = await getServices().data.cafe.retrieveCafe({ id: this.cafe.id });
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