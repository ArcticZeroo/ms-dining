import type { IActiveOrderSummary, OrderCafePartStatus } from '@msdining/common/models/cart';

export interface ICheckoutCafeResult {
    cafeId: string;
    buyOnDemandOrderId: string;
    buyOnDemandOrderNumber: string;
    subtotal: number;
    tax: number;
    total: number;
    waitTimeMin: number;
    waitTimeMax: number;
}

export interface ICheckoutResult {
    orderSessionId: string;
    cafeResults: ICheckoutCafeResult[];
}

export interface IPreparePaymentResult {
    siteToken: string;
    iframeUrl: string;
    buyOnDemandOrderId: string;
    buyOnDemandOrderNumber: string;
    expiresAt: string;
}

export interface ICompleteOrderResult {
    buyOnDemandOrderNumber: string;
    waitTimeMin: number;
    waitTimeMax: number;
    completedAt: string;
}

export interface IOrderService {
    /** Create an order from the user's cart. Calls BoD to build each cafe's cart. */
    checkout(data: { userId: string }): Promise<ICheckoutResult>;

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
