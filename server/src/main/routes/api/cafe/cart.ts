import Router from '@koa/router';
import { CartItemDataSchema, CartItemUpdateSchema } from '@msdining/common/models/cart';
import type { ICartResponse } from '@msdining/common/models/cart';
import { menuItemBaseToDTO } from '@msdining/common/util/menu-item-serde';
import { attachRouter, getUserIdOrThrow } from '../../../util/koa.js';
import { requireAuthenticated } from '../../../middleware/auth.js';
import { getServices } from '../../../services/registry.js';
import { jsonStringifyWithoutNull } from '../../../../shared/util/serde.js';

/** Convert the domain ICartResponse to the wire-safe shape for JSON serialization. */
const serializeCartResponse = (cart: ICartResponse) => ({
    ...cart,
    items: cart.items.map(item => ({
        ...item,
        menuItem: {
            ...menuItemBaseToDTO(item.menuItem),
            totalReviewCount: 0,
            overallRating:    0,
            firstAppearance:  '',
        },
    })),
});

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

    // POST /cart/items — add item to cart
    router.post('/items', async ctx => {
        const userId = getUserIdOrThrow(ctx);
        const item = CartItemDataSchema.parse(ctx.request.body);
        const cart = await getServices().data.cart.addItem({ userId, item });
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
