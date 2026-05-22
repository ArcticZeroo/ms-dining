import type { IActiveOrderSummary } from '@msdining/common/models/cart';
import type {
    ICheckoutResult,
    IPreparePaymentResult,
    ICompleteOrderResult,
} from '@msdining/common/models/order';

export type { ICheckoutCafeResult } from '@msdining/common/models/order';

export interface IOrderService {
    /** Create an order from the user's cart. Calls BoD to build each cafe's cart. */
    startCheckout(data: { userId: string }): Promise<ICheckoutResult>;

    /** Set the alias + phone for an order (before first payment). */
    setPaymentIdentity(data: {
        userId: string;
        orderSessionId: string;
        alias: string;
        phoneNumberWithCountryCode: string;
    }): Promise<void>;

    /** Get iframe payment token for a specific cafe in an order. */
    preparePayment(data: {
        userId: string;
        orderSessionId: string;
        cafeId: string;
        iframeCssUrl: string;
    }): Promise<IPreparePaymentResult>;

    /** Complete payment for a specific cafe using the iframe token. */
    completeOrder(data: {
        userId: string;
        orderSessionId: string;
        cafeId: string;
        paymentToken: string;
        cardInfo: {
            accountNumberMasked: string;
            cardIssuer: string;
            expirationYearMonth: string;
            cardHolderName: string;
            postalCode: string;
        };
    }): Promise<ICompleteOrderResult>;

    /** Abandon unfinished cafe parts of an order. */
    abandonOrder(data: {
        userId: string;
        orderSessionId: string;
    }): Promise<void>;

    /** Get the active order for a user (if any). */
    getActiveOrder(data: { userId: string }): Promise<IActiveOrderSummary | undefined>;
}
