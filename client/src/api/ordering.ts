import type { IPaymentCardInfo } from '@msdining/common/models/cart';
import type {
    ICafeOrder,
    ICompleteOrderResult,
    IOrderItem,
    IPreparePaymentResult,
    IRecentOrderSummary,
} from '@msdining/common/models/order';
import {
    CafeOrderSchema,
    CompleteOrderResultSchema,
    PreparePaymentResultSchema,
    RecentOrderSummarySchema,
} from '@msdining/common/models/order';
import z from 'zod';
import { JSON_HEADERS, makeJsonRequestWithSchema } from './request.ts';

const ORDER_BASE = '/api/dining/order';
const OrderCountSchema = z.object({ count: z.number() });
const RecentOrdersResponseSchema = z.object({
    orders: z.array(RecentOrderSummarySchema),
});

export type OrderHistorySince = '7d' | '30d' | 'all';

export interface ISynthesisFlags {
    conceptSchedule: boolean;
    orderingContext: boolean;
    payConfig: boolean;
    kioskItems: boolean;
}

export abstract class OrderClient {
    static async preparePayment(
        cafeId: string,
        items: IOrderItem[],
        synthesisFlags?: ISynthesisFlags,
    ): Promise<IPreparePaymentResult> {
        return makeJsonRequestWithSchema({
            path:   `${ORDER_BASE}/cafes/${cafeId}/prepare-payment`,
            schema: PreparePaymentResultSchema,
            options: {
                method:  'POST',
                headers: JSON_HEADERS,
                body:    JSON.stringify({ items, synthesisFlags }),
            },
        });
    }

    static async completeOrder(
        pendingOrderId: string,
        paymentToken: string,
        cardInfo: IPaymentCardInfo,
        alias: string,
        phoneNumber: string,
    ): Promise<ICompleteOrderResult> {
        return makeJsonRequestWithSchema({
            path:   `${ORDER_BASE}/complete/${pendingOrderId}`,
            schema: CompleteOrderResultSchema,
            options: {
                method:  'POST',
                headers: JSON_HEADERS,
                body:    JSON.stringify({ paymentToken, cardInfo, alias, phoneNumber }),
            },
        });
    }

    static async getRecentOrders(): Promise<IRecentOrderSummary[]> {
        const result = await makeJsonRequestWithSchema({
            path:   `${ORDER_BASE}/recent`,
            schema: RecentOrdersResponseSchema,
        });

        return result.orders;
    }

    static async getCompletedOrdersToday(): Promise<ICafeOrder[]> {
        return makeJsonRequestWithSchema({
            path:   `${ORDER_BASE}/today`,
            schema: z.array(CafeOrderSchema),
        });
    }

    static async getOrderHistory(since: OrderHistorySince): Promise<ICafeOrder[]> {
        return makeJsonRequestWithSchema({
            path:   `${ORDER_BASE}/history?since=${since}`,
            schema: z.array(CafeOrderSchema),
        });
    }

    static async getOrderCount(): Promise<{ count: number }> {
        return makeJsonRequestWithSchema({
            path:   `${ORDER_BASE}/count`,
            schema: OrderCountSchema,
        });
    }
}
