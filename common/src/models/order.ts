import { z } from 'zod';

// ─── Checkout ────────────────────────────────────────────────────────

export const CheckoutCafeResultSchema = z.object({
    cafeId:                 z.string(),
    buyOnDemandOrderId:     z.string(),
    buyOnDemandOrderNumber: z.string(),
    subtotal:               z.number(),
    tax:                    z.number(),
    total:                  z.number(),
    waitTimeMin:            z.number().int(),
    waitTimeMax:            z.number().int(),
});

export type ICheckoutCafeResult = z.infer<typeof CheckoutCafeResultSchema>;

export const CheckoutResultSchema = z.object({
    orderSessionId: z.string(),
    cafeResults:    z.array(CheckoutCafeResultSchema),
});

export type ICheckoutResult = z.infer<typeof CheckoutResultSchema>;

// ─── Prepare Payment ─────────────────────────────────────────────────

export const PreparePaymentResultSchema = z.object({
    siteToken:              z.string(),
    iframeUrl:              z.string(),
    buyOnDemandOrderId:     z.string(),
    buyOnDemandOrderNumber: z.string(),
    expiresAt:              z.string(),
});

export type IPreparePaymentResult = z.infer<typeof PreparePaymentResultSchema>;

// ─── Complete Order ──────────────────────────────────────────────────

export const CompleteOrderResultSchema = z.object({
    buyOnDemandOrderNumber: z.string(),
    waitTimeMin:            z.number().int(),
    waitTimeMax:            z.number().int(),
    completedAt:            z.string().transform(s => new Date(s)),
});

/** Wire type (server → client, before transform). */
export type ICompleteOrderResultDTO = z.input<typeof CompleteOrderResultSchema>;

/** Client type (after zod transform — completedAt is Date). */
export type ICompleteOrderResult = z.infer<typeof CompleteOrderResultSchema>;
