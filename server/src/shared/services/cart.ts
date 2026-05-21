/**
 * Cart service interface.
 *
 * Server-side cart replaces client localStorage. One cart per authenticated user.
 * Every mutation returns the full hydrated cart so the client always has fresh state.
 * Cart is locked (mutations return CONFLICT) while an active order exists.
 */

import type {
    ICartItemData,
    ICartItemUpdate,
    ICartResponse,
} from '@msdining/common/models/cart';

export interface ICartService {
    getCart(data: { userId: string }): Promise<ICartResponse>;
    addItem(data: { userId: string; item: ICartItemData }): Promise<ICartResponse>;
    updateItem(data: { userId: string; itemId: string; update: ICartItemUpdate }): Promise<ICartResponse>;
    removeItem(data: { userId: string; itemId: string }): Promise<ICartResponse>;
    clearCart(data: { userId: string }): Promise<ICartResponse>;
}
