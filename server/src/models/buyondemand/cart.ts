export interface IAddToOrderResponse {
    orderDetails: {
        orderId: string,
        orderNumber: string,
        taxExcludedTotalAmount: {
            amount: string
        },
        taxTotalAmount: {
            amount: string
        },
        totalDueAmount: {
            amount: string
        },
    },
}

export interface ICardProcessorTokenResponse {
    token: string;
}