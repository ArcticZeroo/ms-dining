import type { IOrderService } from '../../../../shared/services/order.js';
import { OrderOrchestrator } from './order-orchestrator.js';

export const orderServiceCommands = {
    preparePayment: ({ userId, cafeId, items, alias, phoneNumberWithCountryCode, iframeCssUrl }) =>
        OrderOrchestrator.preparePayment(userId, cafeId, items, alias, phoneNumberWithCountryCode, iframeCssUrl),
    completeOrder: ({ userId, pendingOrderId, paymentToken, cardInfo }) =>
        OrderOrchestrator.completeOrder(userId, pendingOrderId, paymentToken, cardInfo),
    getCompletedOrdersToday: ({ userId }) =>
        OrderOrchestrator.getCompletedOrdersToday(userId),
} satisfies IOrderService;
