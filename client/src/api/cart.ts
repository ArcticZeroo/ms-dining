import type {
    ICartItemData,
    ICartItemUpdate,
    ICartResponse,
} from '@msdining/common/models/cart';
import { JSON_HEADERS, makeJsonRequest } from './request.ts';

const CART_BASE = '/api/dining/cart';

export abstract class CartClient {
    static async getCart(): Promise<ICartResponse> {
        return makeJsonRequest({ path: CART_BASE });
    }

    static async addItem(item: ICartItemData): Promise<ICartResponse> {
        return makeJsonRequest({
            path:    `${CART_BASE}/items`,
            options: {
                method:  'POST',
                headers: JSON_HEADERS,
                body:    JSON.stringify(item),
            },
        });
    }

    static async updateItem(itemId: string, update: ICartItemUpdate): Promise<ICartResponse> {
        return makeJsonRequest({
            path:    `${CART_BASE}/items/${itemId}`,
            options: {
                method:  'PATCH',
                headers: JSON_HEADERS,
                body:    JSON.stringify(update),
            },
        });
    }

    static async removeItem(itemId: string): Promise<ICartResponse> {
        return makeJsonRequest({
            path:    `${CART_BASE}/items/${itemId}`,
            options: { method: 'DELETE' },
        });
    }

    static async clearCart(): Promise<ICartResponse> {
        return makeJsonRequest({
            path:    CART_BASE,
            options: { method: 'DELETE' },
        });
    }
}
