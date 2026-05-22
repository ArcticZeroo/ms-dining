import type { IRguestCardInfo } from '@msdining/common/models/cart';
import type {
    ICafeOrderSummary,
    ICompleteOrderResult,
    IOrderItem,
    IPreparePaymentResult,
} from '@msdining/common/models/order';
import {
    CafeOrderSummarySchema,
    CompleteOrderResultSchema,
    PreparePaymentResultSchema,
} from '@msdining/common/models/order';
import z from 'zod';
import { JSON_HEADERS, makeJsonRequestWithSchema } from './request.ts';

const ORDER_BASE = '/api/dining/order';

export abstract class OrderClient {
    static async preparePayment(
        cafeId: string,
        items: IOrderItem[],
        alias: string,
        phoneNumber: string,
    ): Promise<IPreparePaymentResult> {
        return makeJsonRequestWithSchema({
            path:   `${ORDER_BASE}/cafes/${cafeId}/prepare-payment`,
            schema: PreparePaymentResultSchema,
            options: {
                method:  'POST',
                headers: JSON_HEADERS,
                body:    JSON.stringify({ items, alias, phoneNumber }),
            },
        });
    }

    static async completeOrder(
        pendingOrderId: string,
        paymentToken: string,
        cardInfo: IRguestCardInfo,
    ): Promise<ICompleteOrderResult> {
        return makeJsonRequestWithSchema({
            path:   `${ORDER_BASE}/complete/${pendingOrderId}`,
            schema: CompleteOrderResultSchema,
            options: {
                method:  'POST',
                headers: JSON_HEADERS,
                body:    JSON.stringify({ paymentToken, cardInfo }),
            },
        });
    }

    static async getCompletedOrdersToday(): Promise<ICafeOrderSummary[]> {
        return makeJsonRequestWithSchema({
            path:   `${ORDER_BASE}/today`,
            schema: z.array(CafeOrderSummarySchema),
        });
    }
}
