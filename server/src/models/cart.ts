import { ICartItem } from "@msdining/common/dist/models/cart.js";

export interface IOrderingContext {
    onDemandTerminalId: string;
    profitCenterId: string;
    storePriceLevel: string;
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
    alias: string;
    cafeId: string;
    items: ICartItem[];
    cardData: ICardData;
    // +12345678900
    phoneNumberWithCountryCode: string;
}