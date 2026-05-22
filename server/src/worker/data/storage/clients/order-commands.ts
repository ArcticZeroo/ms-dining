import type { IOrderService } from '../../../../shared/services/order.js';
import { OrderStorageClient } from './order.js';

export const orderServiceCommands = {
    checkout: ({ userId }) =>
        OrderStorageClient.checkout(userId),
    setPaymentIdentity: ({ userId, orderSessionId, alias, phoneNumberWithCountryCode }) =>
        OrderStorageClient.setPaymentIdentity(userId, orderSessionId, alias, phoneNumberWithCountryCode),
    preparePayment: ({ userId, orderSessionId, cafeId, iframeCssUrl }) =>
        OrderStorageClient.preparePayment(userId, orderSessionId, cafeId, iframeCssUrl),
    completeOrder: ({ userId, orderSessionId, cafeId, paymentToken, cardInfo }) =>
        OrderStorageClient.completeOrder(userId, orderSessionId, cafeId, paymentToken, cardInfo),
    abandonOrder: ({ userId, orderSessionId }) =>
        OrderStorageClient.abandonOrder(userId, orderSessionId),
    getActiveOrder: ({ userId }) =>
        OrderStorageClient.getActiveOrder(userId),
} satisfies IOrderService;
