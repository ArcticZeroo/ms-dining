import type {
    ICartItemData,
    ICartItemUpdate,
} from '@msdining/common/models/cart';
import { CartResponseSchema } from '@msdining/common/models/cart';
import { JSON_HEADERS, makeJsonRequestWithSchema } from './request.ts';
import type { IClientCartResponse } from '../store/zustand/server-cart.ts';

const CART_BASE = '/api/dining/cart';

// CartResponseSchema includes a zod transform that converts the wire-format
// IMenuItemDTO into the in-memory IMenuItemBase (string[] → Set, epoch → Date).
// No manual conversion needed after parsing.
const fetchCart = (path: string, options?: RequestInit): Promise<IClientCartResponse> =>
    makeJsonRequestWithSchema({ path, schema: CartResponseSchema, options });

export abstract class CartClient {
    static async getCart(): Promise<IClientCartResponse> {
        return fetchCart(CART_BASE);
    }

    static async addItem(item: ICartItemData): Promise<IClientCartResponse> {
        return fetchCart(`${CART_BASE}/items`, {
            method:  'POST',
            headers: JSON_HEADERS,
            body:    JSON.stringify(item),
        });
    }

    static async updateItem(itemId: string, update: ICartItemUpdate): Promise<IClientCartResponse> {
        return fetchCart(`${CART_BASE}/items/${itemId}`, {
            method:  'PATCH',
            headers: JSON_HEADERS,
            body:    JSON.stringify(update),
        });
    }

    static async removeItem(itemId: string): Promise<IClientCartResponse> {
        return fetchCart(`${CART_BASE}/items/${itemId}`, { method: 'DELETE' });
    }

    static async clearCart(): Promise<IClientCartResponse> {
        return fetchCart(CART_BASE, { method: 'DELETE' });
    }
}
