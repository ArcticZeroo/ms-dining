import { z } from 'zod';

// ─── Start Checkout ──────────────────────────────────────────────────

export const StartCheckoutCafeResultSchema = z.object({
    cafeId:                 z.string(),
    buyOnDemandOrderId:     z.string(),
    buyOnDemandOrderNumber: z.string(),
    subtotal:               z.number(),
    tax:                    z.number(),
    total:                  z.number(),
    waitTimeMin:            z.number().int(),
    waitTimeMax:            z.number().int(),
});

export type IStartCheckoutCafeResult = z.infer<typeof StartCheckoutCafeResultSchema>;

export const StartCheckoutResultSchema = z.object({
    orderSessionId: z.string(),
    cafeResults:    z.array(StartCheckoutCafeResultSchema),
});

export type IStartCheckoutResult = z.infer<typeof StartCheckoutResultSchema>;

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
