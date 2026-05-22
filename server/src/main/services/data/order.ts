import type { IOrderService } from '../../../shared/services/order.js';
import { dataHandler } from './handler.js';

export const orderService: IOrderService = {
    startCheckout: (data) =>
        dataHandler.sendRequest('order', 'startCheckout', data),
    setPaymentIdentity: (data) =>
        dataHandler.sendRequest('order', 'setPaymentIdentity', data),
    preparePayment: (data) =>
        dataHandler.sendRequest('order', 'preparePayment', data),
    completeOrder: (data) =>
        dataHandler.sendRequest('order', 'completeOrder', data),
    abandonRemainingCafes: (data) =>
        dataHandler.sendRequest('order', 'abandonRemainingCafes', data),
    getActiveOrder: (data) =>
        dataHandler.sendRequest('order', 'getActiveOrder', data),
};
