import type { ICheckoutResult, IPreparePaymentResult, ICompleteOrderResult } from './order-types.ts';
import type { IRguestCardInfo } from '@msdining/common/models/cart';
import { JSON_HEADERS, makeJsonRequest } from './request.ts';

const ORDER_BASE = '/api/dining/order';

export abstract class NewOrderingClient {
    static async checkout(): Promise<ICheckoutResult> {
        return makeJsonRequest({
            path:    `${ORDER_BASE}/checkout`,
            options: { method: 'POST' },
        });
    }

    static async setPaymentIdentity(orderId: string, alias: string, phoneNumberWithCountryCode: string): Promise<void> {
        await makeJsonRequest({
            path:    `${ORDER_BASE}/${orderId}/identity`,
            options: {
                method:  'POST',
                headers: JSON_HEADERS,
                body:    JSON.stringify({ alias, phoneNumberWithCountryCode }),
            },
        });
    }

    static async preparePayment(orderId: string, cafeId: string): Promise<IPreparePaymentResult> {
        return makeJsonRequest({
            path:    `${ORDER_BASE}/${orderId}/cafes/${cafeId}/prepare-payment`,
            options: { method: 'POST' },
        });
    }

    static async completeOrder(
        orderId: string,
        cafeId: string,
        paymentToken: string,
        cardInfo: IRguestCardInfo,
    ): Promise<ICompleteOrderResult> {
        return makeJsonRequest({
            path:    `${ORDER_BASE}/${orderId}/cafes/${cafeId}/complete`,
            options: {
                method:  'POST',
                headers: JSON_HEADERS,
                body:    JSON.stringify({ paymentToken, cardInfo }),
            },
        });
    }

    static async abandonOrder(orderId: string): Promise<void> {
        await makeJsonRequest({
            path:    `${ORDER_BASE}/${orderId}`,
            options: { method: 'DELETE' },
        });
    }
}
