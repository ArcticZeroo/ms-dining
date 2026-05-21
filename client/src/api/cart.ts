import type {
    ICartItemData,
    ICartItemUpdate,
    ICartResponse,
} from '@msdining/common/models/cart';
import { CartResponseSchema } from '@msdining/common/models/cart';
import { JSON_HEADERS, makeJsonRequestWithSchema } from './request.ts';

const CART_BASE = '/api/dining/cart';

// The zod schema uses z.any() for menuItem (IMenuItemBase has Sets/Dates
// that can't be expressed in zod), so we cast the parsed result.
const fetchCart = async (path: string, options?: RequestInit): Promise<ICartResponse> => {
    return makeJsonRequestWithSchema({ path, schema: CartResponseSchema, options }) as Promise<ICartResponse>;
};

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
