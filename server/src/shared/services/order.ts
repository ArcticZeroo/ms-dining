import type { IPaymentCardInfo } from '@msdining/common/models/cart';
import type {
    ICafeOrderSummary,
    ICompleteOrderResultDTO,
    IOrderItem,
    IPreparePaymentResult,
} from '@msdining/common/models/order';

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
    }): Promise<ICafeOrderSummary[]>;
}
