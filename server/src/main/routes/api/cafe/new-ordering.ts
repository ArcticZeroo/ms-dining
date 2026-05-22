import Router from '@koa/router';
import { z } from 'zod';
import { OrderItemSchema } from '@msdining/common/models/order';
import { attachRouter, getUserIdOrThrow } from '../../../util/koa.js';
import { requireAuthenticated } from '../../../middleware/auth.js';
import { getServices } from '../../../services/registry.js';
import { jsonStringifyWithoutNull } from '../../../../shared/util/serde.js';
import { webserverHost } from '../../../../shared/constants/config.js';
import { isDev } from '../../../../shared/util/env.js';

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

export const registerNewOrderingRoutes = (parent: Router) => {
    const router = new Router({ prefix: '/order' });

    router.use(requireAuthenticated);

    router.post('/cafes/:cafeId/prepare-payment', async ctx => {
        const userId = getUserIdOrThrow(ctx);
        const cafeId = ctx.params.cafeId!;
        const body = PreparePaymentSchema.parse(ctx.request.body);
        const iframeCssUrl = `${isDev ? ctx.origin : webserverHost}/iframe.css`;

        const result = await getServices().data.order.preparePayment({
            userId,
            cafeId,
            items: body.items,
            iframeCssUrl,
        });

        ctx.body = jsonStringifyWithoutNull(result);
    });

    router.post('/complete/:pendingOrderId', async ctx => {
        const userId = getUserIdOrThrow(ctx);
        const pendingOrderId = ctx.params.pendingOrderId!;
        const body = CompleteOrderSchema.parse(ctx.request.body);

        const result = await getServices().data.order.completeOrder({
            userId,
            pendingOrderId,
            paymentToken:               body.paymentToken,
            cardInfo:                   body.cardInfo,
            alias:                      body.alias,
            phoneNumberWithCountryCode: body.phoneNumber,
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
