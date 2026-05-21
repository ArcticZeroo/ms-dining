import type {
    ICartItemData,
    ICartItemUpdate,
    ICartResponse,
} from '@msdining/common/models/cart';
import { CartResponseSchema } from '@msdining/common/models/cart';
import { JSON_HEADERS, makeJsonRequestWithSchema } from './request.ts';

const CART_BASE = '/api/dining/cart';

export abstract class CartClient {
    static async getCart(): Promise<ICartResponse> {
        return makeJsonRequestWithSchema({ path: CART_BASE, schema: CartResponseSchema });
    }

    static async addItem(item: ICartItemData): Promise<ICartResponse> {
        return makeJsonRequestWithSchema({
            path:    `${CART_BASE}/items`,
            schema:  CartResponseSchema,
            options: {
                method:  'POST',
                headers: JSON_HEADERS,
                body:    JSON.stringify(item),
            },
        });
    }

    static async updateItem(itemId: string, update: ICartItemUpdate): Promise<ICartResponse> {
        return makeJsonRequestWithSchema({
            path:    `${CART_BASE}/items/${itemId}`,
            schema:  CartResponseSchema,
            options: {
                method:  'PATCH',
                headers: JSON_HEADERS,
                body:    JSON.stringify(update),
            },
        });
    }

    static async removeItem(itemId: string): Promise<ICartResponse> {
        return makeJsonRequestWithSchema({
            path:    `${CART_BASE}/items/${itemId}`,
            schema:  CartResponseSchema,
            options: { method: 'DELETE' },
        });
    }

    static async clearCart(): Promise<ICartResponse> {
        return makeJsonRequestWithSchema({
            path:    CART_BASE,
            schema:  CartResponseSchema,
            options: { method: 'DELETE' },
        });
    }
}
