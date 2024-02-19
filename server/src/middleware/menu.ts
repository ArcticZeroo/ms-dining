import { ERROR_BODIES } from '@msdining/common/dist/responses.js';
import Koa from 'koa';
import { isAnyCafeCurrentlyUpdating } from '../api/cafe/cache/update.js';

export const requireNoMenusUpdating: Koa.Middleware = (ctx, next) => {
    if (isAnyCafeCurrentlyUpdating()) {
        ctx.status = 503;
        ctx.body = ERROR_BODIES.menusCurrentlyUpdating;
        return;
    }

    return next();
};