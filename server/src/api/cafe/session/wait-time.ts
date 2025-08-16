import { BuyOnDemandClient, JSON_HEADERS } from '../buy-ondemand/buy-ondemand-client.js';
import { isDuckType } from '@arcticzeroo/typeguard';
import { IBuyOnDemandWaitTimeResponse, IBuyOnDemandWaitTimeSection } from '../../../models/buyondemand/cart.js';
import { IWaitTimeResponse } from '@msdining/common/dist/models/http.js';
import { ICafe } from '../../../models/cafe.js';

const isDuckTypeWaitTimeSection = (data: unknown): data is IBuyOnDemandWaitTimeSection => isDuckType<IBuyOnDemandWaitTimeSection>(data, { minutes: 'number' });

export class WaitTimeSession {
    constructor(readonly client: BuyOnDemandClient) {
    }

    public static async retrieveWaitTime(cafe: ICafe, itemCount: number): Promise<IWaitTimeResponse> {
        const client = await BuyOnDemandClient.createAsync(cafe);
        const session = new WaitTimeSession(client);
        return session.#retrieveWaitTime(itemCount);
    }

    async #retrieveWaitTime(itemCount: number): Promise<IWaitTimeResponse> {
        const config = this.client.config;
        if (!config) {
            throw new Error('Cafe config is not set');
        }

        const response = await this.client.requestAsync(
            `/order/${config.tenantId}/${config.contextId}/getWaitTimeForItems`,
            {
                method:  'POST',
                headers: { ...JSON_HEADERS },
                body:    JSON.stringify({
                    cartItems:          [
                        {
                            // I have no idea why this is required, but it changes the response
                            // to have one "etf" object instead of "minTime" and "maxTime".
                            kitchenVideoId: ' ',
                            quantity:       itemCount
                        }
                    ],
                    varianceEnabled:    true,
                    variancePercentage: 5
                })
            }
        );

        const json = await response.json();

        if (!isDuckType<IBuyOnDemandWaitTimeResponse>(json, { minTime: 'object', maxTime: 'object' })) {
            throw new Error('Invalid response format: missing min/maxTime or in wrong format');
        }

        if (!isDuckTypeWaitTimeSection(json.minTime) || !isDuckTypeWaitTimeSection(json.maxTime)) {
            throw new Error('Invalid response format: bad min/maxTime');
        }

        return {
            minTime: json.minTime.minutes,
            maxTime: json.maxTime.minutes
        };
    }
}