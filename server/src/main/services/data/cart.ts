import type { ICartService } from '../../../shared/services/cart.js';
import { dataHandler } from './handler.js';

export const cartService: ICartService = {
    getCart: (data) =>
        dataHandler.sendRequest('cart', 'getCart', data),
    addItem: (data) =>
        dataHandler.sendRequest('cart', 'addItem', data),
    updateItem: (data) =>
        dataHandler.sendRequest('cart', 'updateItem', data),
    removeItem: (data) =>
        dataHandler.sendRequest('cart', 'removeItem', data),
    clearCart: (data) =>
        dataHandler.sendRequest('cart', 'clearCart', data),
};
