/** Types for the new ordering API (mirrors server/shared/services/order.ts). */

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
