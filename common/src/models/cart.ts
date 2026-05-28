import { z } from 'zod';
import { MenuItemBaseSchema } from '../util/menu-item-serde.js';
import { OrderItemSchema } from './order.js';
import { SerializedModifierSchema } from './shared.js';

export type { ISerializedModifier } from './shared.js';

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

export { SerializedModifierSchema } from './shared.js';

export const CartItemDataSchema = OrderItemSchema;

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
    stationName:         z.string().optional(),
});

export type ICartItemRecord = z.output<typeof CartItemRecordSchema>;
export type ICartItemRecordDTO = z.input<typeof CartItemRecordSchema>;

// ─── Cafe availability ───────────────────────────────────────────────

export interface ICafeHours {
    opensAt: number;
    closesAt: number;
}

const CafeHoursSchema = z.object({
    opensAt:  z.number().int(),
    closesAt: z.number().int(),
});

const CafeShutdownStateSchema = z.object({
    message:     z.string().nullable(),
    type:        z.enum(['full', 'online_ordering_only']),
    isTemporary: z.boolean(),
    resumeInfo:  z.string().optional(),
});

const CafeAvailabilityOpenSchema = z.object({
    status: z.literal('open'),
    hours:  CafeHoursSchema,
});

const CafeAvailabilityShutdownSchema = z.object({
    status:   z.literal('shutdown'),
    shutdown: CafeShutdownStateSchema,
    hours:    CafeHoursSchema.optional(),
});

const CafeAvailabilityUnknownSchema = z.object({
    status: z.literal('unknown'),
});

export const CafeAvailabilitySchema = z.discriminatedUnion('status', [
    CafeAvailabilityOpenSchema,
    CafeAvailabilityShutdownSchema,
    CafeAvailabilityUnknownSchema,
]);

export type ICafeAvailability = z.infer<typeof CafeAvailabilitySchema>;

// ─── Cart response ───────────────────────────────────────────────────

export const CafeCartGroupSchema = z.object({
    cafeId:       z.string(),
    items:        z.array(CartItemRecordSchema),
    availability: CafeAvailabilitySchema,
});

export type ICafeCartGroup = z.output<typeof CafeCartGroupSchema>;
export type ICafeCartGroupDTO = z.input<typeof CafeCartGroupSchema>;

export const CartResponseSchema = z.object({
    cafes: z.array(CafeCartGroupSchema),
});

export interface ICartResponse {
    cafes: ICafeCartGroup[];
}

export interface ICartResponseDTO {
    cafes: ICafeCartGroupDTO[];
}
