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
    ICartResponseWire,
} from '@msdining/common/models/cart';

export interface ICartService {
    /** Get the user's cart (creates empty if none). Includes activeOrder if one exists. */
    getCart(data: { userId: string }): Promise<ICartResponseWire>;

    /** Add an item to the cart. Returns full cart. Rejects with CONFLICT if order is active. */
    addItem(data: { userId: string; item: ICartItemData }): Promise<ICartResponseWire>;

    /** Update a cart item. Returns full cart. Rejects with CONFLICT if order is active. */
    updateItem(data: { userId: string; itemId: string; update: ICartItemUpdate }): Promise<ICartResponseWire>;

    /** Remove a cart item. Returns full cart. Rejects with CONFLICT if order is active. */
    removeItem(data: { userId: string; itemId: string }): Promise<ICartResponseWire>;

    /** Clear all items from the cart. Returns empty cart. Rejects with CONFLICT if order is active. */
    clearCart(data: { userId: string }): Promise<ICartResponseWire>;
}
