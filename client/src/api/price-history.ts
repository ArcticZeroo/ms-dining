import { IPriceHistoryResponse, PriceHistoryResponseSchema } from '@msdining/common/models/price-history';

export abstract class PriceHistoryClient {
    public static async retrievePriceHistoryAsync(): Promise<IPriceHistoryResponse> {
        const response = await fetch('/api/price-history');

        if (!response.ok) {
            throw new Error('Failed to get price history');
        }

        // Validate the shape so a stale/legacy blob surfaces as a clean error
        // (retry UI) instead of crashing deep in a component.
        return PriceHistoryResponseSchema.parse(await response.json());
    }
}
