import { BuyOnDemandClient, JSON_HEADERS } from '../buy-ondemand/buy-ondemand-client.js';
import { IWaitTimeResponse } from '@msdining/common/models/http';
import { ICafe } from '../../../models/cafe.js';
import { BuyOnDemandWaitTimeEtfSchema, BuyOnDemandWaitTimeMinMaxSchema } from '../../../models/buyondemand/cart.js';

const parseWaitTimeResponse = (json: unknown): IWaitTimeResponse => {
    const minMaxResult = BuyOnDemandWaitTimeMinMaxSchema.safeParse(json);
    if (minMaxResult.success) {
        return {
            minTime: minMaxResult.data.minTime.minutes,
            maxTime: minMaxResult.data.maxTime.minutes,
        };
    }

    const etfResult = BuyOnDemandWaitTimeEtfSchema.safeParse(json);
    if (etfResult.success) {
        return {
            minTime: etfResult.data.etf.minutes,
            maxTime: etfResult.data.etf.minutes,
        };
    }

    throw new Error(`Invalid wait time response: ${JSON.stringify(json)}`);
};

export class WaitTimeSession {
    constructor(readonly client: BuyOnDemandClient) {
    }

    // Standalone wait time (creates its own session, uses dummy items)
    public static async retrieveWaitTime(cafe: ICafe, itemCount: number): Promise<IWaitTimeResponse> {
        const client = await BuyOnDemandClient.createAsync(cafe);
        return WaitTimeSession.retrieveWaitTimeWithClient(client, itemCount);
    }

    // Simple wait time with just a count (dummy kitchenVideoId)
    public static async retrieveWaitTimeWithClient(client: BuyOnDemandClient, itemCount: number): Promise<IWaitTimeResponse> {
        const json = await WaitTimeSession.#fetchWaitTime(client, [
            { kitchenVideoId: ' ', quantity: itemCount }
        ]);
        return parseWaitTimeResponse(json);
    }

    // Full wait time with actual cart item data — more accurate, returns minTime/maxTime format
    public static async retrieveWaitTimeWithCartItems(client: BuyOnDemandClient, cartItems: unknown[]): Promise<IWaitTimeResponse> {
        const json = await WaitTimeSession.#fetchWaitTime(client, cartItems);
        const result = parseWaitTimeResponse(json);

        // Dev comparison: also fetch with dummy approach and log if different
        const totalQuantity = (cartItems as Array<{ quantity?: number }>).reduce((sum, item) => sum + (item.quantity ?? 1), 0);
        WaitTimeSession.retrieveWaitTimeWithClient(client, totalQuantity)
            .then(dummyResult => {
                if (dummyResult.minTime !== result.minTime || dummyResult.maxTime !== result.maxTime) {
                    console.log(`[WaitTime] Results differ — full: ${result.minTime}-${result.maxTime}min, dummy: ${dummyResult.minTime}-${dummyResult.maxTime}min`);
                }
            })
            .catch(() => { /* ignore comparison failures */ });

        return result;
    }

    static async #fetchWaitTime(client: BuyOnDemandClient, cartItems: unknown[]): Promise<unknown> {
        const config = client.config;
        if (!config) {
            throw new Error('Cafe config is not set');
        }

        const response = await client.requestAsync(
            `/order/${config.tenantId}/${config.contextId}/getWaitTimeForItems`,
            {
                method:  'POST',
                headers: { ...JSON_HEADERS },
                body:    JSON.stringify({
                    cartItems,
                    varianceEnabled:    true,
                    variancePercentage: 5,
                    kitchenContextId:   null,
                    deliveryType:       'pickup'
                })
            }
        );

        return response.json();
    }
}