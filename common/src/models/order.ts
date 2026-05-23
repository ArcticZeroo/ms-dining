import { z } from 'zod';
import { SerializedModifierSchema } from './cart.js';
import { MenuItemBaseSchema } from '../util/menu-item-serde.js';

export const OrderItemSchema = z.object({
    menuItemId:          z.string().min(1),
    quantity:            z.number().int().min(1),
    specialInstructions: z.string().optional(),
    modifiers:           z.array(SerializedModifierSchema).default([]),
});

export type IOrderItem = z.infer<typeof OrderItemSchema>;

export const PreparePaymentResultSchema = z.object({
    pendingOrderId:         z.string(),
    siteToken:              z.string(),
    iframeUrl:              z.string(),
    buyOnDemandOrderId:     z.string(),
    buyOnDemandOrderNumber: z.string(),
    expiresAt:              z.string(),
});

export type IPreparePaymentResult = z.infer<typeof PreparePaymentResultSchema>;

export const CompleteOrderResultSchema = z.object({
    buyOnDemandOrderNumber: z.string(),
    waitTimeMin:            z.number().int(),
    waitTimeMax:            z.number().int(),
    completedAt:            z.string().transform(s => new Date(s)),
});

export type ICompleteOrderResultDTO = z.input<typeof CompleteOrderResultSchema>;
export type ICompleteOrderResult = z.infer<typeof CompleteOrderResultSchema>;

export const CafeOrderItemSchema = z.object({
    menuItemId:          z.string(),
    quantity:            z.number().int(),
    price:               z.number(),
    specialInstructions: z.string().nullish().transform(val => val ?? null),
    modifiers:           z.array(SerializedModifierSchema).default([]),
    menuItem:            MenuItemBaseSchema,
});

export type ICafeOrderItem = z.infer<typeof CafeOrderItemSchema>;

export const CafeOrderSchema = z.object({
    id:                     z.string(),
    cafeId:                 z.string(),
    buyOnDemandOrderNumber: z.string(),
    subtotal:               z.number(),
    tax:                    z.number(),
    total:                  z.number(),
    waitTimeMin:            z.number().int(),
    waitTimeMax:            z.number().int(),
    completedAt:            z.string().transform(s => new Date(s)),
    items:                  z.array(CafeOrderItemSchema),
});

export type ICafeOrderDTO = z.input<typeof CafeOrderSchema>;
export type ICafeOrder = z.infer<typeof CafeOrderSchema>;
