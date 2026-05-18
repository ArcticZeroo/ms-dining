/**
 * TestBuyOnDemandClient: Subclass of BuyOnDemandClient that routes all
 * requests to an in-memory TestBuyOnDemandServer instead of making real
 * HTTP requests.
 */

import { Response } from 'node-fetch';
import { BuyOnDemandClient } from '../api/cafe/buy-ondemand/buy-ondemand-client.js';
import { CafeStorageClient } from '../api/storage/clients/cafe.js';
import { ICafe } from '../models/cafe.js';
import { TestBuyOnDemandServer } from './index.js';
import { TestResponse } from './models.js';
import { validateSuccessResponse } from '../util/request.js';

export class TestBuyOnDemandClient extends BuyOnDemandClient {
    readonly #server: TestBuyOnDemandServer;

    constructor(cafe: ICafe, server: TestBuyOnDemandServer) {
        super(cafe);
        this.#server = server;
    }

    /**
     * Create a TestBuyOnDemandClient, performing login + config retrieval
     * through the in-memory server.
     */
    public static async createTestAsync(cafe: ICafe, server: TestBuyOnDemandServer): Promise<TestBuyOnDemandClient> {
        const client = new TestBuyOnDemandClient(cafe, server);
        // Trigger the same initialization as the real client.
        // performLoginAsync and retrieveConfigDataAsync both call this.requestAsync(),
        // which our override routes to the in-memory server.
        await client.refreshLogin();
        // refreshLogin only does login — we need to trigger config retrieval too.
        // Config retrieval happens in the parent's createAsync flow via private methods.
        // Since we can't call the private #retrieveConfigDataAsync, we call requestAsync
        // for /config ourselves and populate the config.
        await client._initConfigFromTestServer();
        return client;
    }

    /**
     * Override: routes requests to the in-memory test server instead of fetch().
     * Calls the parent's _getRequestOptions so the Authorization + Csrf-Token
     * headers (set after #performLoginAsync) are still attached — the test
     * server validates those just like the real BoD API does.
     */
    public async requestAsync(path: string, options: any = {}, shouldValidateSuccess: boolean = true): Promise<Response> {
        const method = (options.method ?? 'GET').toUpperCase();
        const optionsWithToken = this._getRequestOptions(options);

        const headers: Record<string, string> = {};
        if (optionsWithToken.headers) {
            for (const [key, value] of Object.entries(optionsWithToken.headers)) {
                headers[key] = String(value);
            }
        }

        const testResponse = await this.#server.handleRequest(
            this.cafe.id,
            method,
            path,
            {
                headers,
                body: optionsWithToken.body,
            }
        );

        const response = testResponseToNodeFetchResponse(testResponse);

        if (shouldValidateSuccess) {
            validateSuccessResponse(response);
        }

        return response;
    }

    /**
     * Fetch config from the test server and populate this.config.
     * Mirrors what #retrieveConfigDataAsync does in the parent class.
     */
    async _initConfigFromTestServer(): Promise<void> {
        const response = await this.requestAsync('/config');
        const json = await response.json() as any;

        const [store] = json.storeList;
        if (!store) throw new Error('Test server config: storeList is empty');

        const [displayProfileId] = store.displayProfileId;
        if (!displayProfileId) throw new Error('Test server config: displayProfileId is missing');

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
        };

        // Mirror real BuyOnDemandClient.#retrieveConfigDataAsync: persist cafe
        // to the database so FK references from MenuItem/DailyCafe resolve.
        // Best-effort; failures are logged but not fatal (matches prod behavior).
        try {
            await CafeStorageClient.createCafeAsync(this.cafe, this.config);
        } catch (err) {
            console.warn(`[TestBuyOnDemandClient] Unable to save cafe to database:`, err);
        }
    }
}

function testResponseToNodeFetchResponse(testResponse: TestResponse): Response {
    let bodyStr: string;
    if (testResponse.rawBody != null) {
        bodyStr = testResponse.rawBody;
    } else if (testResponse.body != null) {
        bodyStr = JSON.stringify(testResponse.body);
    } else {
        bodyStr = '';
    }

    const headers: Record<string, string> = {
        ...(testResponse.headers ?? {}),
    };

    // Set content-type if not already set
    if (!headers['content-type'] && testResponse.rawBody == null && testResponse.body != null) {
        headers['content-type'] = 'application/json';
    }

    return new Response(bodyStr, {
        status: testResponse.status,
        statusText: testResponse.statusText ?? 'OK',
        headers,
    });
}
