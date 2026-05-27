import type { IPaymentCardInfo } from '@msdining/common/models/cart';
import type {
    ICafeOrderDTO,
    ICompleteOrderResultDTO,
    IOrderItem,
    IPreparePaymentResult,
} from '@msdining/common/models/order';

export type OrderHistorySince = '7d' | '30d' | 'all';

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
