import { isDuckType } from '@arcticzeroo/typeguard';
import { IOrderCompletionData, IOrderCompletionResponse } from '@msdining/common/models/cart';

export const isValidOrderCompletionResponse = (expectedCafeIds: Set<string>, orderData: unknown): orderData is IOrderCompletionResponse => {
    if (!orderData || typeof orderData !== 'object') {
        return false;
    }

    const entries = Object.entries(orderData);
    if (entries.length !== expectedCafeIds.size) {
        return false;
    }

    for (const [key, value] of Object.entries(orderData)) {
        if (!expectedCafeIds.has(key)) {
            return false;
        }

        if (!isDuckType<IOrderCompletionData>(value, {
            lastCompletedStage: 'string',
            waitTimeMax: 'string',
            waitTimeMin: 'string',
            orderNumber: 'string'
        })) {
            return false;
        }
    }

    return true;
}