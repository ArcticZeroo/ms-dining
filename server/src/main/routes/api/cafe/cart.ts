import Router from '@koa/router';
import { z } from 'zod';
import { CartItemDataSchema, CartItemUpdateSchema } from '@msdining/common/models/cart';
import { attachRouter, getUserIdOrThrow } from '../../../util/koa.js';
import { requireAuthenticated } from '../../../middleware/auth.js';
import { getServices } from '../../../../shared/services/registry.js';
import { jsonStringifyWithoutNull } from '../../../../shared/util/serde.js';
import { serializeCartResponse } from '../../../util/order-serde.js';

export const registerCartRoutes = (parent: Router) => {
    const router = new Router({ prefix: '/cart' });

    // All cart routes require authentication
    router.use(requireAuthenticated);

    // GET /cart — fetch current cart (creates empty if none)
    router.get('/', async ctx => {
        const userId = getUserIdOrThrow(ctx);
        const cart = await getServices().data.cart.getCart({ userId });
        ctx.body = jsonStringifyWithoutNull(serializeCartResponse(cart));
    });

    // POST /cart/items — add item(s) to cart
    router.post('/items', async ctx => {
        const userId = getUserIdOrThrow(ctx);
        const items = z.array(CartItemDataSchema).parse(ctx.request.body);
        const cart = await getServices().data.cart.addItems({ userId, items });
        ctx.body = jsonStringifyWithoutNull(serializeCartResponse(cart));
    });

    // PATCH /cart/items/:itemId — update a cart item
    router.patch('/items/:itemId', async ctx => {
        const userId = getUserIdOrThrow(ctx);
        const itemId = ctx.params.itemId!;
        const update = CartItemUpdateSchema.parse(ctx.request.body);
        const cart = await getServices().data.cart.updateItem({ userId, itemId, update });
        ctx.body = jsonStringifyWithoutNull(serializeCartResponse(cart));
    });

    // DELETE /cart/items/:itemId — remove a cart item
    router.delete('/items/:itemId', async ctx => {
        const userId = getUserIdOrThrow(ctx);
        const itemId = ctx.params.itemId!;
        const cart = await getServices().data.cart.removeItem({ userId, itemId });
        ctx.body = jsonStringifyWithoutNull(serializeCartResponse(cart));
    });

    // DELETE /cart — clear entire cart
    router.delete('/', async ctx => {
        const userId = getUserIdOrThrow(ctx);
        const cart = await getServices().data.cart.clearCart({ userId });
        ctx.body = jsonStringifyWithoutNull(serializeCartResponse(cart));
    });

    attachRouter(parent, router);
};
