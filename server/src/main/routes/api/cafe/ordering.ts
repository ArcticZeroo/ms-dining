import Router from '@koa/router';
import { z } from 'zod';
import { OrderItemSchema } from '@msdining/common/models/order';
import { attachRouter, getUserIdOrThrow } from '../../../util/koa.js';
import { requireAuthenticated } from '../../../middleware/auth.js';
import { getServices } from '../../../../shared/services/registry.js';
import { jsonStringifyWithoutNull } from '../../../../shared/util/serde.js';
import { webserverHost } from '../../../../shared/constants/config.js';
import { isDev } from '../../../../shared/util/env.js';
import { setTelemetryProperties } from '../../../middleware/telemetry.js';
import { executeTrackedOrderStep } from '../../../../worker/data/ordering/order-telemetry.js';

const PreparePaymentSchema = z.object({
    items: z.array(OrderItemSchema).min(1),
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

        setTelemetryProperties(ctx, { cafeId, itemCount: String(body.items.length) });

        const result = await executeTrackedOrderStep({
            name:       'prepare',
            properties: { cafeId, userId, itemCount: String(body.items.length) },
            execute:    () => getServices().data.order.preparePayment({ userId, cafeId, items: body.items, iframeCssUrl }),
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

    router.get('/today', async ctx => {
        const userId = getUserIdOrThrow(ctx);
        const result = await getServices().data.order.getCompletedOrdersToday({ userId });
        ctx.body = jsonStringifyWithoutNull(result);
    });

    attachRouter(parent, router);
};
