import type { ICartService } from '../../../shared/services/cart.js';
import { dataHandler } from './handler.js';

export const cartService: ICartService = {
    getCart: (data) =>
        dataHandler.sendRequest('cart', 'getCart', data),
    addItems: (data) =>
        dataHandler.sendRequest('cart', 'addItems', data),
    updateItem: (data) =>
        dataHandler.sendRequest('cart', 'updateItem', data),
    removeItem: (data) =>
        dataHandler.sendRequest('cart', 'removeItem', data),
    clearCart: (data) =>
        dataHandler.sendRequest('cart', 'clearCart', data),
};
