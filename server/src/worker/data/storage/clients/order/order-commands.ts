import type { IOrderService } from '../../../../../shared/services/order.js';
import { OrderOrchestrator } from '../../../ordering/order-orchestrator.js';
import { OrderStorageClient } from './order.js';

export const orderServiceCommands = {
    preparePayment: ({ userId, cafeId, items, iframeCssUrl }) =>
        OrderOrchestrator.preparePayment(userId, cafeId, items, iframeCssUrl),
    completeOrder: ({ userId, pendingOrderId, paymentToken, cardInfo, alias, phoneNumberWithCountryCode }) =>
        OrderOrchestrator.completeOrder(userId, pendingOrderId, paymentToken, cardInfo, alias, phoneNumberWithCountryCode),
    getCompletedOrdersToday: ({ userId }) =>
        OrderOrchestrator.getCompletedOrdersToday(userId),
    getOrderHistory: ({ userId, since }) =>
        OrderStorageClient.getOrderHistory(userId, since),
    getOrderCount: ({ userId }) =>
        OrderStorageClient.getOrderCount(userId),
} satisfies IOrderService;
