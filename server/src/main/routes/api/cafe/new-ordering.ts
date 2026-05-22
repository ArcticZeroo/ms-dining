import Router from '@koa/router';
import { z } from 'zod';
import { attachRouter, getUserIdOrThrow } from '../../../util/koa.js';
import { requireAuthenticated } from '../../../middleware/auth.js';
import { getServices } from '../../../services/registry.js';
import { jsonStringifyWithoutNull } from '../../../../shared/util/serde.js';
import { webserverHost } from '../../../../shared/constants/config.js';
import { isDev } from '../../../../shared/util/env.js';

const PaymentIdentitySchema = z.object({
    alias:                      z.string().min(1),
    phoneNumberWithCountryCode: z.string().min(1),
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
});

export const registerNewOrderingRoutes = (parent: Router) => {
    const router = new Router({ prefix: '/order' });

    router.use(requireAuthenticated);

    // POST /order/checkout — create order from current cart
    router.post('/checkout', async ctx => {
        const userId = getUserIdOrThrow(ctx);
        const result = await getServices().data.order.startCheckout({ userId });
        ctx.body = jsonStringifyWithoutNull(result);
    });

    // PUT /order/:orderId/identity — set alias + phone before first payment (idempotent)
    router.put('/:orderId/identity', async ctx => {
        const userId = getUserIdOrThrow(ctx);
        const orderSessionId = ctx.params.orderId!;
        const body = PaymentIdentitySchema.parse(ctx.request.body);

        await getServices().data.order.setPaymentIdentity({
            userId,
            orderSessionId,
            alias:                      body.alias,
            phoneNumberWithCountryCode: body.phoneNumberWithCountryCode,
        });

        ctx.status = 204;
    });

    // GET /order/:orderId/cafes/:cafeId/prepare-payment
    router.get('/:orderId/cafes/:cafeId/prepare-payment', async ctx => {
        const userId = getUserIdOrThrow(ctx);
        const orderSessionId = ctx.params.orderId!;
        const cafeId = ctx.params.cafeId!;
        const iframeCssUrl = `${isDev ? ctx.origin : webserverHost}/iframe.css`;

        const result = await getServices().data.order.preparePayment({
            userId,
            orderSessionId,
            cafeId,
            iframeCssUrl,
        });

        ctx.body = jsonStringifyWithoutNull(result);
    });

    // POST /order/:orderId/cafes/:cafeId/complete
    router.post('/:orderId/cafes/:cafeId/complete', async ctx => {
        const userId = getUserIdOrThrow(ctx);
        const orderSessionId = ctx.params.orderId!;
        const cafeId = ctx.params.cafeId!;
        const body = CompleteOrderSchema.parse(ctx.request.body);

        const result = await getServices().data.order.completeOrder({
            userId,
            orderSessionId,
            cafeId,
            paymentToken: body.paymentToken,
            cardInfo:     body.cardInfo,
        });

        ctx.body = jsonStringifyWithoutNull(result);
    });

    // DELETE /order/:orderId — abandon unfinished cafe parts
    router.delete('/:orderId', async ctx => {
        const userId = getUserIdOrThrow(ctx);
        const orderSessionId = ctx.params.orderId!;

        await getServices().data.order.abandonRemainingCafes({ userId, orderSessionId });

        ctx.status = 204;
    });

    attachRouter(parent, router);
};
