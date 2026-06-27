import type { ICartEstimateResponse } from '@msdining/common/models/http';
import type { IPaymentCardInfo } from '@msdining/common/models/cart';
import type {
    ICafeOrderDTO,
    ICompleteOrderResultDTO, IOrderHistorySummaryResponse,
    IOrderItem,
    IPreparePaymentResult,
    IRecentOrderSummary,
} from '@msdining/common/models/order';

export type OrderHistorySince = 'today' | '7d' | '30d' | 'all';

export interface IOrderService {
    preparePayment(data: {
        userId: string;
        cafeId: string;
        items: IOrderItem[];
        iframeCssUrl: string;
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

    getOrderHistorySummary(data: {
        userId: string;
    }): Promise<IOrderHistorySummaryResponse>;

    getCartEstimate(data: {
        cafeId: string;
        userId: string;
    }): Promise<ICartEstimateResponse>;

    keepalivePrewarm(data: {
        userId: string;
    }): Promise<number>;
}
