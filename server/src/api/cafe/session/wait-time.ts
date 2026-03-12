import { BuyOnDemandClient, JSON_HEADERS } from '../buy-ondemand/buy-ondemand-client.js';
import { IWaitTimeResponse } from '@msdining/common/models/http';
import { ICafe } from '../../../models/cafe.js';
import { BuyOnDemandWaitTimeSchema } from '../../../models/buyondemand/cart.js';

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

		const buyOnDemandResponse = BuyOnDemandWaitTimeSchema.safeParse(json);

		if (!buyOnDemandResponse.success) {
			throw new Error(`Invalid response from buy on demand wait time API: ${JSON.stringify(json)}, errors: ${JSON.stringify(buyOnDemandResponse.error.issues)}`);
		}

		// Used to be min/max, may as well keep supporting both in case it changes back/different formats at different times
        return {
            minTime: buyOnDemandResponse.data.etf.minutes,
            maxTime: buyOnDemandResponse.data.etf.minutes
        };
    }
}