import { z } from 'zod';
import { ActiveOrderSummarySchema } from './cart.js';

// ─── Start Checkout ──────────────────────────────────────────────────

// The checkout response is just the active order summary — the client
// uses it to populate the store and navigate to the payment page.
export const StartCheckoutResultSchema = ActiveOrderSummarySchema;

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
