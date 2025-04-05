import Router from '@koa/router';
import { registerCafeRoutes } from './cafe/cafe.js';
import { attachRouter } from '../../util/koa.js';
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
    router.use((ctx) => {
        ctx.throw(404, 'Resource not found');
    });

    attachRouter(parent, router);
};