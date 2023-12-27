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