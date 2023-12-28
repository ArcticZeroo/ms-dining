import { ERROR_BODIES } from '@msdining/common/dist/responses.js';
import Koa from 'koa';
import { ApplicationContext } from '../constants/context.js';

export const requireMenusNotUpdating: Koa.Middleware = (ctx, next) => {
    if (ApplicationContext.isMenuUpdateInProgress) {
        ctx.status = 503;
        ctx.body = ERROR_BODIES.menusCurrentlyUpdating;
        return;
    }

    return next();
};