import Router from '@koa/router';
import { registerCafeRoutes } from './cafe/cafe.js';
import { attachRouter } from '../../util/koa.js';
import { registerAnalyticsRoutes } from './analytics.js';

export const registerApiRoutes = (parent: Router) => {
    const router = new Router({
        prefix: '/api'
    });

    registerCafeRoutes(router);
    registerAnalyticsRoutes(router);

    attachRouter(parent, router);
};