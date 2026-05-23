import { z } from 'zod';
import { SerializedModifierSchema } from './cart.js';

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

export const CafeOrderItemSummarySchema = z.object({
    name:                z.string(),
    quantity:            z.number().int(),
    price:               z.number(),
    specialInstructions: z.string().nullish().transform(val => val ?? null),
});

export type ICafeOrderItemSummary = z.infer<typeof CafeOrderItemSummarySchema>;

export const CafeOrderSummarySchema = z.object({
    id:                     z.string(),
    cafeId:                 z.string(),
    buyOnDemandOrderNumber: z.string(),
    subtotal:               z.number(),
    tax:                    z.number(),
    total:                  z.number(),
    waitTimeMin:            z.number().int(),
    waitTimeMax:            z.number().int(),
    completedAt:            z.string().transform(s => new Date(s)),
    items:                  z.array(CafeOrderItemSummarySchema).default([]),
});

export type ICafeOrderSummaryDTO = z.input<typeof CafeOrderSummarySchema>;
export type ICafeOrderSummary = z.infer<typeof CafeOrderSummarySchema>;
