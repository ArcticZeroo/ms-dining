import type {
    ICartItemData,
    ICartItemUpdate,
    ICartResponse,
} from '@msdining/common/models/cart';
import { CartResponseSchema } from '@msdining/common/models/cart';
import { JSON_HEADERS, makeJsonRequestWithSchema } from './request.ts';

const CART_BASE = '/api/dining/cart';

// CartResponseSchema includes a zod transform that converts the wire-format
// IMenuItemDTO into the in-memory IMenuItemBase (string[] → Set, epoch → Date).
const fetchCart = (path: string, options?: RequestInit): Promise<ICartResponse> =>
    makeJsonRequestWithSchema({ path, schema: CartResponseSchema, options });

export abstract class CartClient {
    static async getCart(): Promise<ICartResponse> {
        return fetchCart(CART_BASE);
    }

    static async addItem(item: ICartItemData): Promise<ICartResponse> {
        return fetchCart(`${CART_BASE}/items`, {
            method:  'POST',
            headers: JSON_HEADERS,
            body:    JSON.stringify(item),
        });
    }

    static async updateItem(itemId: string, update: ICartItemUpdate): Promise<ICartResponse> {
        return fetchCart(`${CART_BASE}/items/${itemId}`, {
            method:  'PATCH',
            headers: JSON_HEADERS,
            body:    JSON.stringify(update),
        });
    }

    static async removeItem(itemId: string): Promise<ICartResponse> {
        return fetchCart(`${CART_BASE}/items/${itemId}`, { method: 'DELETE' });
    }

    static async clearCart(): Promise<ICartResponse> {
        return fetchCart(CART_BASE, { method: 'DELETE' });
    }
}
