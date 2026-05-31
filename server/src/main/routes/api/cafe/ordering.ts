import Router from '@koa/router';
import { z } from 'zod';
import { OrderItemSchema } from '@msdining/common/models/order';
import { attachRouter, getUserIdOrThrow, isAdminAsync } from '../../../util/koa.js';
import { requireAuthenticated } from '../../../middleware/auth.js';
import { getServices } from '../../../../shared/services/registry.js';
import { jsonStringifyWithoutNull } from '../../../../shared/util/serde.js';
import { webserverHost } from '../../../../shared/constants/config.js';
import { isDev } from '../../../../shared/util/env.js';
import { setTelemetryProperties } from '../../../middleware/telemetry.js';
import { executeTrackedOrderStep } from '../../../../shared/ordering/order-telemetry.js';
import type { ISynthesisFlags } from '../../../../shared/services/order.js';

const SynthesisFlagsSchema = z.object({
    conceptSchedule: z.boolean(),
    orderingContext: z.boolean(),
    payConfig:       z.boolean(),
    kioskItems:      z.boolean(),
});

const PreparePaymentSchema = z.object({
    items:          z.array(OrderItemSchema).min(1),
    synthesisFlags: SynthesisFlagsSchema.optional(),
});

const CompleteOrderSchema = z.object({
    paymentToken: z.string().min(1),
    cardInfo:     z.object({
        accountNumberMasked: z.string(),
        cardIssuer:          z.string(),
        expirationYearMonth: z.string(),
        cardHolderName:      z.string(),
        postalCode:          z.string(),
    }),
    alias:       z.string().min(1),
    phoneNumber: z.string().min(1),
});

export const registerOrderingRoutes = (parent: Router) => {
    const router = new Router({ prefix: '/order' });

    router.use(requireAuthenticated);

    router.post('/cafes/:cafeId/prepare-payment', async ctx => {
        const userId = getUserIdOrThrow(ctx);
        const cafeId = ctx.params.cafeId!;
        const body = PreparePaymentSchema.parse(ctx.request.body);
        const iframeCssUrl = `${isDev ? ctx.origin : webserverHost}/iframe.css`;

        // Only admins may override synthesis flags
        let synthesisFlags: ISynthesisFlags | undefined;
        if (body.synthesisFlags) {
            if (await isAdminAsync(ctx)) {
                synthesisFlags = body.synthesisFlags;
            }
        }

        setTelemetryProperties(ctx, { cafeId, itemCount: String(body.items.length) });

        const result = await executeTrackedOrderStep({
            name:       'prepare',
            properties: { cafeId, userId, itemCount: String(body.items.length) },
            execute:    () => getServices().data.order.preparePayment({ userId, cafeId, items: body.items, iframeCssUrl, synthesisFlags }),
            completedProperties: (result) => ({ pendingOrderId: result.pendingOrderId }),
            durationMetric:           'prepare.durationMs',
            durationMetricProperties: { cafeId },
        });

        setTelemetryProperties(ctx, { pendingOrderId: result.pendingOrderId });
        ctx.body = jsonStringifyWithoutNull(result);
    });

    router.post('/complete/:pendingOrderId', async ctx => {
        const userId = getUserIdOrThrow(ctx);
        const pendingOrderId = ctx.params.pendingOrderId!;
        const body = CompleteOrderSchema.parse(ctx.request.body);

        setTelemetryProperties(ctx, { pendingOrderId });

        const result = await executeTrackedOrderStep({
            name:       'complete',
            properties: { pendingOrderId, userId },
            execute:    () => getServices().data.order.completeOrder({
                userId,
                pendingOrderId,
                paymentToken:               body.paymentToken,
                cardInfo:                   body.cardInfo,
                alias:                      body.alias,
                phoneNumberWithCountryCode: body.phoneNumber,
            }),
            completedProperties: (result) => ({ orderNumber: String(result.buyOnDemandOrderNumber) }),
            durationMetric:      'complete.durationMs',
        });

        ctx.body = jsonStringifyWithoutNull(result);
    });

    router.get('/recent', async ctx => {
        const userId = getUserIdOrThrow(ctx);
        const orders = await getServices().data.order.getRecentOrders({ userId });
        ctx.body = jsonStringifyWithoutNull({ orders });
    });

    router.get('/today', async ctx => {
        const userId = getUserIdOrThrow(ctx);
        const result = await getServices().data.order.getCompletedOrdersToday({ userId });
        ctx.body = jsonStringifyWithoutNull(result);
    });

    const OrderHistorySinceSchema = z.enum(['today', '7d', '30d', 'all']).default('30d');

    router.get('/history', async ctx => {
        const userId = getUserIdOrThrow(ctx);
        const since = OrderHistorySinceSchema.parse(ctx.query.since);
        const result = await getServices().data.order.getOrderHistory({ userId, since });
        ctx.body = jsonStringifyWithoutNull(result);
    });

    router.get('/count', async ctx => {
        const userId = getUserIdOrThrow(ctx);
        const count = await getServices().data.order.getOrderCount({ userId });
        ctx.body = JSON.stringify({ count });
    });

    attachRouter(parent, router);
};
