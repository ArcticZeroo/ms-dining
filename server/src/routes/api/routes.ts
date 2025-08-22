import Router from '@koa/router';
import { registerCafeRoutes } from './cafe/cafe.js';
import { attachRouter, CATCH_ALL_PATH } from '../../util/koa.js';
import { registerAnalyticsRoutes } from './analytics.js';
import { registerDevRoutes } from './dev.js';
import { registerAuthRoutes } from './auth.js';

export const registerApiRoutes = (parent: Router) => {
    const router = new Router({
        prefix: '/api'
    });

    registerCafeRoutes(router);
    registerAnalyticsRoutes(router);
    registerDevRoutes(router);
    registerAuthRoutes(router);

    // Bad routes under /api should not hit the catch-all for the SPA
    router.all(CATCH_ALL_PATH, (ctx) => {
        ctx.throw(404, 'API route not found');
    });

    attachRouter(parent, router);
};