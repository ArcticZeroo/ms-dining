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

export interface ICardData {
    name: string;
    cardNumber: string;
    expirationMonth: string;
    expirationYear: string;
    securityCode: string;
    postalCode: string;
    userAgent: string;
}

export interface ISubmitOrderParams {
    phoneNumberWithCountryCode: string;
    alias: string;
    cardData: ICardData;
}

export interface ISubmitOrderItems {
    [cafeId: string]: ISerializedCartItem[];
}

export interface ISubmitOrderRequest extends ISubmitOrderParams {
    itemsByCafeId: ISubmitOrderItems;
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
    alias: string;
    phoneNumberWithCountryCode: string;
}

export interface IPrepareOrderResponse {
    [cafeId: string]: {
        siteToken: string;
        iframeUrl: string;
        orderId: string;
        orderNumber: string;
    };
}

export interface ICompleteOrderRequest {
    orderId: string;
    paymentToken: string;
    cardInfo: IRguestCardInfo;
    alias: string;
}

export type ICompleteOrderResponse = IOrderCompletionData;
