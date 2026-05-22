import type { IOrderService } from '../../../../shared/services/order.js';
import { OrderOrchestrator } from './order-orchestrator.js';
import { OrderStorageClient } from './order.js';

export const orderServiceCommands = {
    checkout: ({ userId }) =>
        OrderOrchestrator.checkout(userId),
    setPaymentIdentity: ({ userId, orderSessionId, alias, phoneNumberWithCountryCode }) =>
        OrderStorageClient.setPaymentIdentity(userId, orderSessionId, alias, phoneNumberWithCountryCode),
    preparePayment: ({ userId, orderSessionId, cafeId, iframeCssUrl }) =>
        OrderOrchestrator.preparePayment(userId, orderSessionId, cafeId, iframeCssUrl),
    completeOrder: ({ userId, orderSessionId, cafeId, paymentToken, cardInfo }) =>
        OrderOrchestrator.completeOrder(userId, orderSessionId, cafeId, paymentToken, cardInfo),
    abandonOrder: ({ userId, orderSessionId }) =>
        OrderOrchestrator.abandonOrder(userId, orderSessionId),
    getActiveOrder: ({ userId }) =>
        OrderStorageClient.getActiveOrder(userId),
} satisfies IOrderService;
