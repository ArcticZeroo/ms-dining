import type { IActiveOrderSummary } from '@msdining/common/models/cart';
import type {
    ICheckoutResult,
    IPreparePaymentResult,
    ICompleteOrderResultDTO,
} from '@msdining/common/models/order';

export type { ICheckoutCafeResult } from '@msdining/common/models/order';

export interface IOrderService {
    /** Create an order from the user's cart with payment identity. */
    startCheckout(data: {
        userId: string;
        alias: string;
        phoneNumberWithCountryCode: string;
    }): Promise<ICheckoutResult>;

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
    }): Promise<ICompleteOrderResultDTO>;

    /** Abandon unfinished cafe parts and return their items to the cart. */
    abandonRemainingCafes(data: {
        userId: string;
        orderSessionId: string;
    }): Promise<void>;

    /** Get the active order for a user (if any). */
    getActiveOrder(data: { userId: string }): Promise<IActiveOrderSummary | undefined>;
}
