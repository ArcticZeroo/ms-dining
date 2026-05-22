import { z } from 'zod';

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

export const SerializedModifierSchema = z.object({
    modifierId: z.string(),
    choiceIds:  z.array(z.string()),
});

export const CartItemDataSchema = z.object({
    menuItemId:          z.string().min(1),
    quantity:            z.number().int().min(1),
    specialInstructions: z.string().optional(),
    modifiers:           z.array(SerializedModifierSchema).default([]),
});

export type ICartItemData = z.infer<typeof CartItemDataSchema>;

export const CartItemUpdateSchema = z.object({
    quantity:            z.number().int().min(1).optional(),
    specialInstructions: z.string().nullish().transform(val => val ?? null).optional(),
    modifiers:           z.array(SerializedModifierSchema).optional(),
}).refine(
    data => data.quantity !== undefined || data.specialInstructions !== undefined || data.modifiers !== undefined,
    { message: 'At least one field must be provided' },
);

export type ICartItemUpdate = z.infer<typeof CartItemUpdateSchema>;

import { MenuItemBaseSchema } from '../util/menu-item-serde.js';

export const CartItemRecordSchema = z.object({
    id:                  z.string(),
    menuItemId:          z.string(),
    quantity:            z.number().int(),
    specialInstructions: z.string().nullish().transform(val => val ?? null),
    modifiers:           z.array(SerializedModifierSchema),
    createdAt:           z.string(),
    updatedAt:           z.string(),
    menuItem:            MenuItemBaseSchema,
    isAvailable:         z.boolean(),
});

export type ICartItemRecord = z.output<typeof CartItemRecordSchema>;
export type ICartItemRecordDTO = z.input<typeof CartItemRecordSchema>;

export const CartResponseSchema = z.object({
    items: z.array(CartItemRecordSchema),
});

export interface ICartResponse {
    items: ICartItemRecord[];
}

export interface ICartResponseDTO {
    items: ICartItemRecordDTO[];
}
