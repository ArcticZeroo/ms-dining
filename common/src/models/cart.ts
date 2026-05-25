import { z } from 'zod';
import { MenuItemBaseSchema } from '../util/menu-item-serde.js';

export interface ISerializedModifier {
    modifierId: string;
    choiceIds: Array<string>;
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

export interface IPaymentCardInfo {
    accountNumberMasked: string;
    cardIssuer: string;
    expirationYearMonth: string;
    cardHolderName: string;
    postalCode: string;
}

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
    quantity:            z.number().int().min(1),
    specialInstructions: z.string().nullish().transform(val => val ?? null),
    modifiers:           z.array(SerializedModifierSchema),
});

export type ICartItemUpdate = z.infer<typeof CartItemUpdateSchema>;

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
