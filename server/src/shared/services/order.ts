import type { IPaymentCardInfo } from '@msdining/common/models/cart';
import type {
    ICafeOrderDTO,
    ICompleteOrderResultDTO,
    IOrderItem,
    IPreparePaymentResult,
    IRecentOrderSummary,
} from '@msdining/common/models/order';

export interface ISynthesisFlags {
    /** Use DB station hours instead of POST /concepts for schedule data. */
    conceptSchedule: boolean;
    /** Use DB ordering context instead of GET /sites + POST pay-config + GET profitCenter. */
    orderingContext: boolean;
    /** Use /sites response (already fetched by siteData) as pay config source instead of POST pay-config. */
    payConfig: boolean;
    /** Synthesize kiosk-item detail from DB instead of POST /kiosk-items/{itemId}. */
    kioskItems: boolean;
}

export type OrderHistorySince = 'today' | '7d' | '30d' | 'all';

export interface IOrderService {
    preparePayment(data: {
        userId: string;
        cafeId: string;
        items: IOrderItem[];
        iframeCssUrl: string;
        synthesisFlags?: ISynthesisFlags;
    }): Promise<IPreparePaymentResult>;

    completeOrder(data: {
        userId: string;
        pendingOrderId: string;
        paymentToken: string;
        cardInfo: IPaymentCardInfo;
        alias: string;
        phoneNumberWithCountryCode: string;
    }): Promise<ICompleteOrderResultDTO>;

    getRecentOrders(data: {
        userId: string;
    }): Promise<IRecentOrderSummary[]>;

    getCompletedOrdersToday(data: {
        userId: string;
    }): Promise<ICafeOrderDTO[]>;

    getOrderHistory(data: {
        userId: string;
        since: OrderHistorySince;
    }): Promise<ICafeOrderDTO[]>;

    getOrderCount(data: {
        userId: string;
    }): Promise<number>;
}
