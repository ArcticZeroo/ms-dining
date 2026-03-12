export interface ICartItem {
    itemId: string;
    quantity: number;
    choicesByModifierId: Map<string, Set<string>>;
    specialInstructions?: string;
}

export interface ISerializedModifier {
    modifierId: string;
    choiceIds: Array<string>;
}

export interface ISerializedCartItem {
    itemId: string;
    quantity: number;
    modifiers: Array<ISerializedModifier>;
    specialInstructions?: string;
}

export interface ISubmitOrderItems {
    [cafeId: string]: ISerializedCartItem[];
}

export enum SubmitOrderStage {
    notStarted = 'notStarted',
    addToCart = 'addToCart',
    initializeCardProcessor = 'initializeCardProcessor',
    payment = 'payment',
    closeOrder = 'closeOrder',
    sendTextReceipt = 'sendTextReceipt',
    complete = 'complete'
}

export const SUBMIT_ORDER_STAGES_IN_ORDER = [
    SubmitOrderStage.addToCart,
    SubmitOrderStage.initializeCardProcessor,
    SubmitOrderStage.payment,
    SubmitOrderStage.closeOrder,
    SubmitOrderStage.sendTextReceipt,
    SubmitOrderStage.complete
];

export interface IOrderCompletionData {
    lastCompletedStage: SubmitOrderStage;
    orderNumber: string;
    waitTimeMin: string;
    waitTimeMax: string;
}

export interface IOrderCompletionResponse {
    [cafeId: string]: IOrderCompletionData;
}

// --- rguest iframe payment flow types ---

export interface IRguestCardInfo {
    accountNumberMasked: string;
    cardIssuer: string;
    expirationYearMonth: string;
    cardHolderName: string;
    postalCode: string;
}

export interface IPrepareOrderRequest {
    itemsByCafeId: ISubmitOrderItems;
}

// Response from /prepare/cart — builds cart on server and returns price data
export interface IPrepareCartResponse {
    [cafeId: string]: {
        orderId: string;
        orderNumber: string;
        totalPriceWithTax: number;
        totalPriceWithoutTax: number;
        totalTax: number;
        expiresAt: string;
    };
}

// Request/response for /prepare/payment — gets card processor token for an existing cart session
export interface IPreparePaymentRequest {
    orderId: string;
}

export interface IPreparePaymentResponse {
    siteToken: string;
    iframeUrl: string;
    orderId: string;
    orderNumber: string;
    expiresAt: string;
}

// Legacy combined prepare response (kept for backwards compat)
export interface IPrepareOrderResponse {
    [cafeId: string]: {
        siteToken: string;
        iframeUrl: string;
        orderId: string;
        orderNumber: string;
        expiresAt: string;
    };
}

export interface ICompleteOrderRequest {
    orderId: string;
    paymentToken: string;
    cardInfo: IRguestCardInfo;
    alias: string;
    phoneNumberWithCountryCode: string;
}

export type ICompleteOrderResponse = IOrderCompletionData;
