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

import { z } from 'zod';

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

// --- Cart item update (partial of add data) ---

export const CartItemUpdateSchema = CartItemDataSchema.partial().refine(
    data => Object.keys(data).length > 0,
    { message: 'At least one field must be provided' },
);

export type ICartItemUpdate = z.infer<typeof CartItemUpdateSchema>;

// --- Cart item record (returned from server) ---

export interface ICartItemRecord {
    id: string;
    menuItemId: string;
    quantity: number;
    specialInstructions: string | null;
    modifiers: ISerializedModifier[];
    createdAt: string;
    updatedAt: string;
}

// --- Active order summary (included in cart response when an order is in progress) ---

export interface IOrderCafePartSummary {
    cafeId: string;
    status: OrderCafePartStatus;
    buyOnDemandOrderNumber: string | null;
    total: number | null;
    waitTimeMin: number | null;
    waitTimeMax: number | null;
}

export interface IActiveOrderSummary {
    orderSessionId: string;
    alias: string | null;
    phoneNumber: string | null;
    cafeParts: IOrderCafePartSummary[];
}

// --- Cart response (unified: items + optional active order) ---

export interface ICartResponse {
    items: ICartItemRecord[];
    activeOrder?: IActiveOrderSummary;
}
