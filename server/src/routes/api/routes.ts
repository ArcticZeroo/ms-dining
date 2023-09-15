import Router from '@koa/router';
import { registerDiningHallRoutes } from './dining-halls.js';
import { attachRouter } from '../../util/koa.js';
import { registerAnalyticsRoutes } from './analytics.js';

export const registerApiRoutes = (parent: Router) => {
    const router = new Router({
        prefix: '/api'
    });

    registerDiningHallRoutes(router);
    registerAnalyticsRoutes(router);

    attachRouter(parent, router);
};