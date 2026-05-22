import { z } from 'zod';

// ─── Legacy ordering types (v1) ─────────────────────────────────────
// Still used by the current ordering flow. Will be removed when the
// new DB-backed cart/order flow replaces the old endpoints.

export interface ICartItem {
    itemId: string;
    quantity: number;
    choicesByModifierId: Map<string, Set<string>>;
    specialInstructions?: string;
}

export interface ISerializedModifier {
    modifierId: string;
    choiceIds: Array<string>;
}

export interface ISerializedCartItem {
    itemId: string;
    quantity: number;
    modifiers: Array<ISerializedModifier>;
    specialInstructions?: string;
}

export interface ISubmitOrderItems {
    [cafeId: string]: ISerializedCartItem[];
}

export enum SubmitOrderStage {
    notStarted = 'notStarted',
    addToCart = 'addToCart',
    initializeCardProcessor = 'initializeCardProcessor',
    payment = 'payment',
    closeOrder = 'closeOrder',
    sendTextReceipt = 'sendTextReceipt',
    complete = 'complete'
}

export const SUBMIT_ORDER_STAGES_IN_ORDER = [
    SubmitOrderStage.addToCart,
    SubmitOrderStage.initializeCardProcessor,
    SubmitOrderStage.payment,
    SubmitOrderStage.closeOrder,
    SubmitOrderStage.sendTextReceipt,
    SubmitOrderStage.complete
];

export interface IOrderCompletionData {
    lastCompletedStage: SubmitOrderStage;
    orderNumber: string;
    waitTimeMin: string;
    waitTimeMax: string;
}

export interface IOrderCompletionResponse {
    [cafeId: string]: IOrderCompletionData;
}

// --- rguest iframe payment flow types ---

export interface IRguestCardInfo {
    accountNumberMasked: string;
    cardIssuer: string;
    expirationYearMonth: string;
    cardHolderName: string;
    postalCode: string;
}

export interface IPrepareOrderRequest {
    itemsByCafeId: ISubmitOrderItems;
}

// Response from /prepare/cart — builds cart on server and returns price data
export interface IPrepareCartResponse {
    [cafeId: string]: {
        orderId: string;
        orderNumber: string;
        totalPriceWithTax: number;
        totalPriceWithoutTax: number;
        totalTax: number;
        waitTimeMin: number;
        waitTimeMax: number;
        expiresAt: string;
    };
}

// Request/response for /prepare/payment — gets card processor token for an existing cart session
export interface IPreparePaymentRequest {
    orderId: string;
}

export interface IPreparePaymentResponse {
    siteToken: string;
    iframeUrl: string;
    orderId: string;
    orderNumber: string;
    expiresAt: string;
}

// Legacy combined prepare response (kept for backwards compat)
export interface IPrepareOrderResponse {
    [cafeId: string]: {
        siteToken: string;
        iframeUrl: string;
        orderId: string;
        orderNumber: string;
        expiresAt: string;
    };
}

export interface ICompleteOrderRequest {
    orderId: string;
    paymentToken: string;
    cardInfo: IRguestCardInfo;
    alias: string;
    phoneNumberWithCountryCode: string;
}

export type ICompleteOrderResponse = IOrderCompletionData;

// ─── DB-backed cart types (v2) ───────────────────────────────────────
// Used by both client and server for the new server-side cart API.

// --- Status ---

export const ORDER_CAFE_PART_STATUSES = [
    'pending',
    'payment_pending',
    'completed',
    'failed',
    'abandoned',
] as const;

export type OrderCafePartStatus = typeof ORDER_CAFE_PART_STATUSES[number];

export const ACTIVE_ORDER_CAFE_PART_STATUSES: readonly OrderCafePartStatus[] = ['pending', 'payment_pending'];

// --- Modifier schema (shared between add + update) ---

export const SerializedModifierSchema = z.object({
    modifierId: z.string(),
    choiceIds:  z.array(z.string()),
});

// --- Cart item data (for add-to-cart) ---

export const CartItemDataSchema = z.object({
    menuItemId:          z.string().min(1),
    quantity:            z.number().int().min(1),
    specialInstructions: z.string().optional(),
    modifiers:           z.array(SerializedModifierSchema).default([]),
});

export type ICartItemData = z.infer<typeof CartItemDataSchema>;

// --- Cart item update (only mutable fields) ---

export const CartItemUpdateSchema = z.object({
    quantity:            z.number().int().min(1).optional(),
    specialInstructions: z.string().nullable().optional(),
    modifiers:           z.array(SerializedModifierSchema).optional(),
}).refine(
    data => data.quantity !== undefined || data.specialInstructions !== undefined || data.modifiers !== undefined,
    { message: 'At least one field must be provided' },
);

export type ICartItemUpdate = z.infer<typeof CartItemUpdateSchema>;

// --- Cart item record (returned from server, enriched with menu data) ---

import { MenuItemBaseSchema } from '../util/menu-item-serde.js';

export const CartItemRecordSchema = z.object({
    id:                  z.string(),
    menuItemId:          z.string(),
    quantity:            z.number().int(),
    specialInstructions: z.string().nullish(),
    modifiers:           z.array(SerializedModifierSchema),
    createdAt:           z.string(),
    updatedAt:           z.string(),
    menuItem:            MenuItemBaseSchema,
    isAvailable:         z.boolean(),
});

export type ICartItemRecord = z.output<typeof CartItemRecordSchema>;

/** Wire-format cart item before zod transform (menuItem is IMenuItemDTO shape). */
export type ICartItemRecordDTO = z.input<typeof CartItemRecordSchema>;

// --- Active order summary (included in cart response when an order is in progress) ---

export const OrderCafePartSummarySchema = z.object({
    cafeId:                 z.string(),
    status:                 z.enum(ORDER_CAFE_PART_STATUSES),
    buyOnDemandOrderNumber: z.string().nullish().transform(val => val ?? null),
    total:                  z.number().nullish().transform(val => val ?? null),
    waitTimeMin:            z.number().int().nullish().transform(val => val ?? null),
    waitTimeMax:            z.number().int().nullish().transform(val => val ?? null),
    items:                  z.array(CartItemRecordSchema),
});

export type IOrderCafePartSummary = z.infer<typeof OrderCafePartSummarySchema>;

export const ActiveOrderSummarySchema = z.object({
    orderSessionId: z.string(),
    alias:          z.string().nullish().transform(val => val ?? null),
    phoneNumber:    z.string().nullish().transform(val => val ?? null),
    cafeParts:      z.array(OrderCafePartSummarySchema),
});

export type IActiveOrderSummary = z.infer<typeof ActiveOrderSummarySchema>;

/** Wire types before zod transforms. */
export type IOrderCafePartSummaryDTO = z.input<typeof OrderCafePartSummarySchema>;
export type IActiveOrderSummaryDTO = z.input<typeof ActiveOrderSummarySchema>;

// --- Cart response (unified: items + optional active order) ---

export const CartResponseSchema = z.object({
    items:       z.array(CartItemRecordSchema),
    activeOrder: ActiveOrderSummarySchema.optional(),
});

// Manually defined because ICartItemRecord includes IMenuItemBase
// which can't be fully expressed in zod (Sets, Dates, etc.)
export interface ICartResponse {
    items: ICartItemRecord[];
    activeOrder?: IActiveOrderSummary;
}

/** Wire-format response before zod transform. Used by the server/service interface. */
export interface ICartResponseDTO {
    items: ICartItemRecordDTO[];
    activeOrder?: IActiveOrderSummaryDTO;
}
