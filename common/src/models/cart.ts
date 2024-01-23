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

export interface ISubmitOrderRequest extends ISubmitOrderParams {
    itemsByCafeId: {
        [cafeId: string]: ISerializedCartItem[]
    }
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

export interface IOrderCompletionData {
    lastCompletedStage: SubmitOrderStage;
    orderNumber: string;
    waitTimeMin: string;
    waitTimeMax: string;
}

export interface IOrderCompletionResponse {
    [cafeId: string]: IOrderCompletionData;
}
