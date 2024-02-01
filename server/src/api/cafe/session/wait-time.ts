import { CafeDiscoverySession, JSON_HEADERS } from './discovery.js';
import { isDuckType } from '@arcticzeroo/typeguard';
import { IBuyOnDemandWaitTimeResponse, IBuyOnDemandWaitTimeSection } from '../../../models/buyondemand/cart.js';
import { IWaitTimeResponse } from '@msdining/common/dist/models/http.js';

const isDuckTypeWaitTimeSection = (data: unknown): data is IBuyOnDemandWaitTimeSection => isDuckType<IBuyOnDemandWaitTimeSection>(data, { minutes: 'number' });

export class WaitTimeSession extends CafeDiscoverySession {
    public async retrieveWaitTime(itemCount: number): Promise<IWaitTimeResponse> {
        const config = this.config;
        if (!config) {
            throw new Error('Cafe config is not set');
        }

        const response = await this._requestAsync(
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