import type { IOrderService } from '../../../../../shared/services/order.js';
import { OrderOrchestrator } from '../../../ordering/order-orchestrator.js';
import { OrderStorageClient } from './order.js';

export const orderServiceCommands = {
    preparePayment: ({ userId, cafeId, items, iframeCssUrl, synthesisFlags }) =>
        OrderOrchestrator.preparePayment(userId, cafeId, items, iframeCssUrl, synthesisFlags),
    completeOrder: ({ userId, pendingOrderId, paymentToken, cardInfo, alias, phoneNumberWithCountryCode }) =>
        OrderOrchestrator.completeOrder(userId, pendingOrderId, paymentToken, cardInfo, alias, phoneNumberWithCountryCode),
    getRecentOrders: ({ userId }) =>
        OrderStorageClient.getRecentOrders(userId),
    getCompletedOrdersToday: ({ userId }) =>
        OrderOrchestrator.getCompletedOrdersToday(userId),
    getOrderHistory: ({ userId, since }) =>
        OrderStorageClient.getOrderHistory(userId, since),
    getOrderCount: ({ userId }) =>
        OrderStorageClient.getOrderCount(userId),
} satisfies IOrderService;
