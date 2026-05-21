import Router from '@koa/router';
import { z } from 'zod';
import { attachRouter, getUserIdOrThrow } from '../../../util/koa.js';
import { requireAuthenticated } from '../../../middleware/auth.js';
import { getServices } from '../../../services/registry.js';
import { jsonStringifyWithoutNull } from '../../../../shared/util/serde.js';

const ModifierSchema = z.object({
    modifierId: z.string(),
    choiceIds:  z.array(z.string()),
});

const AddItemSchema = z.object({
    cafeId:              z.string().min(1),
    menuItemId:          z.string().min(1),
    quantity:            z.number().int().min(1),
    specialInstructions: z.string().optional(),
    modifiers:           z.array(ModifierSchema).default([]),
});

const UpdateItemSchema = z.object({
    quantity:            z.number().int().min(1).optional(),
    specialInstructions: z.string().nullable().optional(),
    modifiers:           z.array(ModifierSchema).optional(),
}).refine(
    data => data.quantity !== undefined || data.specialInstructions !== undefined || data.modifiers !== undefined,
    { message: 'At least one field must be provided' },
);

export const registerCartRoutes = (parent: Router) => {
    const router = new Router({ prefix: '/cart' });

    // All cart routes require authentication
    router.use(requireAuthenticated);

    // GET /cart — fetch current cart (creates empty if none)
    router.get('/', async ctx => {
        const userId = getUserIdOrThrow(ctx);
        const cart = await getServices().data.cart.getCart({ userId });
        ctx.body = jsonStringifyWithoutNull(cart);
    });

    // POST /cart/items — add item to cart
    router.post('/items', async ctx => {
        const userId = getUserIdOrThrow(ctx);
        const item = AddItemSchema.parse(ctx.request.body);
        const cart = await getServices().data.cart.addItem({ userId, item });
        ctx.body = jsonStringifyWithoutNull(cart);
    });

    // PATCH /cart/items/:itemId — update a cart item
    router.patch('/items/:itemId', async ctx => {
        const userId = getUserIdOrThrow(ctx);
        const itemId = ctx.params.itemId!;
        const update = UpdateItemSchema.parse(ctx.request.body);
        const cart = await getServices().data.cart.updateItem({ userId, itemId, update });
        ctx.body = jsonStringifyWithoutNull(cart);
    });

    // DELETE /cart/items/:itemId — remove a cart item
    router.delete('/items/:itemId', async ctx => {
        const userId = getUserIdOrThrow(ctx);
        const itemId = ctx.params.itemId!;
        const cart = await getServices().data.cart.removeItem({ userId, itemId });
        ctx.body = jsonStringifyWithoutNull(cart);
    });

    // DELETE /cart — clear entire cart
    router.delete('/', async ctx => {
        const userId = getUserIdOrThrow(ctx);
        const cart = await getServices().data.cart.clearCart({ userId });
        ctx.body = jsonStringifyWithoutNull(cart);
    });

    attachRouter(parent, router);
};
