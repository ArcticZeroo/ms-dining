/**
 * Cart service interface.
 *
 * Server-side cart replaces client localStorage. One cart per authenticated user.
 * Every mutation returns the full hydrated cart so the client always has fresh state.
 * Cart is locked (mutations return 409) while an active order exists.
 */

export interface ISerializedModifier {
    modifierId: string;
    choiceIds: string[];
}

export interface ICartItemData {
    cafeId: string;
    menuItemId: string;
    quantity: number;
    specialInstructions?: string;
    modifiers: ISerializedModifier[];
}

export interface ICartItemRecord {
    id: string;
    cafeId: string;
    menuItemId: string;
    quantity: number;
    specialInstructions: string | null;
    modifiers: ISerializedModifier[];
    createdAt: string;
    updatedAt: string;
}

export interface ICartItemUpdate {
    quantity?: number;
    specialInstructions?: string | null;
    modifiers?: ISerializedModifier[];
}

export interface IActiveOrderSummary {
    orderId: string;
    alias: string | null;
    phoneNumber: string | null;
    cafeOrders: {
        cafeId: string;
        status: string;
        bodOrderNumber: string | null;
        total: number | null;
        waitTimeMin: number | null;
        waitTimeMax: number | null;
    }[];
}

export interface ICartResponse {
    items: ICartItemRecord[];
    activeOrder?: IActiveOrderSummary;
}

export interface ICartService {
    /** Get the user's cart (creates empty if none). Includes activeOrder if one exists. */
    getCart(data: { userId: string }): Promise<ICartResponse>;

    /** Add an item to the cart. Returns full cart. Rejects with CONFLICT if order is active. */
    addItem(data: { userId: string; item: ICartItemData }): Promise<ICartResponse>;

    /** Update a cart item. Returns full cart. Rejects with CONFLICT if order is active. */
    updateItem(data: { userId: string; itemId: string; update: ICartItemUpdate }): Promise<ICartResponse>;

    /** Remove a cart item. Returns full cart. Rejects with CONFLICT if order is active. */
    removeItem(data: { userId: string; itemId: string }): Promise<ICartResponse>;

    /** Clear all items from the cart. Returns empty cart. Rejects with CONFLICT if order is active. */
    clearCart(data: { userId: string }): Promise<ICartResponse>;
}
