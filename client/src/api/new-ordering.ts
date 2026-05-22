import type { IActiveOrderSummary, IRguestCardInfo } from '@msdining/common/models/cart';
import type { IPreparePaymentResult, ICompleteOrderResult } from '@msdining/common/models/order';
import {
    StartCheckoutResultSchema,
    PreparePaymentResultSchema,
    CompleteOrderResultSchema,
} from '@msdining/common/models/order';
import { JSON_HEADERS, makeJsonRequestNoParse, makeJsonRequestWithSchema } from './request.ts';

const ORDER_BASE = '/api/dining/order';

export abstract class OrderClient {
    static async startCheckout(alias: string, phoneNumberWithCountryCode: string): Promise<IActiveOrderSummary> {
        return makeJsonRequestWithSchema({
            path:   `${ORDER_BASE}/checkout`,
            schema: StartCheckoutResultSchema,
            options: {
                method:  'POST',
                headers: JSON_HEADERS,
                body:    JSON.stringify({ alias, phoneNumberWithCountryCode }),
            },
        });
    }

    static async setPaymentIdentity(orderId: string, alias: string, phoneNumberWithCountryCode: string): Promise<void> {
        await makeJsonRequestNoParse({
            path:    `${ORDER_BASE}/${orderId}/identity`,
            options: {
                method:  'PUT',
                headers: JSON_HEADERS,
                body:    JSON.stringify({ alias, phoneNumberWithCountryCode }),
            },
        });
    }

    static async preparePayment(orderId: string, cafeId: string): Promise<IPreparePaymentResult> {
        return makeJsonRequestWithSchema({
            path:   `${ORDER_BASE}/${orderId}/cafes/${cafeId}/prepare-payment`,
            schema: PreparePaymentResultSchema,
        });
    }

    static async completeOrder(
        orderId: string,
        cafeId: string,
        paymentToken: string,
        cardInfo: IRguestCardInfo,
    ): Promise<ICompleteOrderResult> {
        return makeJsonRequestWithSchema({
            path:   `${ORDER_BASE}/${orderId}/cafes/${cafeId}/complete`,
            schema: CompleteOrderResultSchema,
            options: {
                method:  'POST',
                headers: JSON_HEADERS,
                body:    JSON.stringify({ paymentToken, cardInfo }),
            },
        });
    }

    static async abandonRemainingCafes(orderId: string): Promise<void> {
        await makeJsonRequestNoParse({
            path:    `${ORDER_BASE}/${orderId}`,
            options: { method: 'DELETE' },
        });
    }
}
