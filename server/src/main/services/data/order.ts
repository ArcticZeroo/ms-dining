import type { IOrderService } from '../../../shared/services/order.js';
import { dataHandler } from './handler.js';

export const orderService: IOrderService = {
    preparePayment: (data) =>
        dataHandler.sendRequest('order', 'preparePayment', data),
    completeOrder: (data) =>
        dataHandler.sendRequest('order', 'completeOrder', data),
    getCompletedOrdersToday: (data) =>
        dataHandler.sendRequest('order', 'getCompletedOrdersToday', data),
    getOrderHistory: (data) =>
        dataHandler.sendRequest('order', 'getOrderHistory', data),
    getOrderCount: (data) =>
        dataHandler.sendRequest('order', 'getOrderCount', data),
};
