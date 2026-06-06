import { z } from 'zod';
import { zodMapFromWire } from '../util/zod.js';
import { SerializedModifierSchema } from './shared.js';
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
    buyOnDemandOrderId:     z.string(),
    waitTimeMin:            z.number().int(),
    waitTimeMax:            z.number().int(),
    completedAt:            z.string().transform(completedAtString => new Date(completedAtString)),
});

export type ICompleteOrderResultDTO = z.input<typeof CompleteOrderResultSchema>;
export type ICompleteOrderResult = z.infer<typeof CompleteOrderResultSchema>;

export const RecentOrderSummarySchema = z.object({
    cafeId:      z.string(),
    orderNumber: z.string(),
    completedAt: z.string().transform(completedAtString => new Date(completedAtString)),
});

export type IRecentOrderSummaryDTO = z.input<typeof RecentOrderSummarySchema>;
export type IRecentOrderSummary = z.infer<typeof RecentOrderSummarySchema>;

export const CafeOrderReviewSchema = z.object({
    rating:    z.number(),
    comment:   z.string().nullish(),
    createdAt: z.date()
});

export type ICafeOrderReviewData = z.infer<typeof CafeOrderReviewSchema>;

export const CafeOrderItemSchema = z.object({
    menuItemId:          z.string(),
    quantity:            z.number().int(),
    price:               z.number(),
    specialInstructions: z.string().nullish().transform(instructions => instructions ?? null),
    modifiers:           z.array(SerializedModifierSchema).default([]),
    menuItem:            MenuItemBaseSchema,
    stationName:         z.string().optional(),
    review:              z.optional(CafeOrderReviewSchema)
});

export type ICafeOrderItem = z.infer<typeof CafeOrderItemSchema>;

export const CafeOrderSchema = z.object({
    id:                     z.string(),
    cafeId:                 z.string(),
    buyOnDemandOrderId:     z.string(),
    buyOnDemandOrderNumber: z.string(),
    subtotal:               z.number(),
    tax:                    z.number(),
    total:                  z.number(),
    waitTimeMin:            z.number().int(),
    waitTimeMax:            z.number().int(),
    completedAt:            z.string().transform(completedAt => new Date(completedAt)),
    items:                  z.array(CafeOrderItemSchema),
});

export type ICafeOrderDTO = z.input<typeof CafeOrderSchema>;
export type ICafeOrder = z.infer<typeof CafeOrderSchema>;

export const OrderHistoryResponse = z.object({
    count: z.number(),
    countsById: zodMapFromWire(z.string(), z.number())
});
export type IOrderHistorySummaryResponse = z.infer<typeof OrderHistoryResponse>;