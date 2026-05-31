import { BuyOnDemandClient, JSON_HEADERS } from '../../../../shared/buy-ondemand/buy-ondemand-client.js';
import { createBuyOnDemandClient } from '../../../../shared/services/registry.js';
import { IWaitTimeResponse } from '@msdining/common/models/http';
import { ICafe } from '../../../../shared/models/cafe.js';
import { BuyOnDemandWaitTimeEtfSchema, BuyOnDemandWaitTimeMinMaxSchema } from '../../../../shared/models/buyondemand/cart.js';

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

const fetchWaitTimeRaw = async (client: BuyOnDemandClient, cartItems: unknown[]): Promise<IWaitTimeResponse> => {
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

    const json = await response.json();
    return parseWaitTimeResponse(json);
};

/**
 * Fetch wait time using an existing BuyOnDemandClient with actual cart item data.
 */
export const fetchWaitTimeWithCartItems = async (client: BuyOnDemandClient, cartItems: unknown[]): Promise<IWaitTimeResponse> => {
    return fetchWaitTimeRaw(client, cartItems);
};

/**
 * Fetch wait time with a simple item count (dummy items).
 */
export const fetchWaitTimeWithItemCount = async (client: BuyOnDemandClient, itemCount: number): Promise<IWaitTimeResponse> => {
    return fetchWaitTimeRaw(client, [
        { kitchenVideoId: ' ', quantity: itemCount }
    ]);
};

/**
 * Standalone wait time lookup — creates its own BuyOnDemandClient.
 * Used by the wait-time-only endpoint.
 */
export const fetchWaitTime = async (cafe: ICafe, itemCount: number): Promise<IWaitTimeResponse> => {
    const client = await createBuyOnDemandClient(cafe);
    return fetchWaitTimeWithItemCount(client, itemCount);
};
