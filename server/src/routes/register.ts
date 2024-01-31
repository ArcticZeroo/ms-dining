import Router from '@koa/router';
import { registerApiRoutes } from './api/routes.js';
import Koa from 'koa';
import { registerSitemapRoutes } from './sitemap.js';

export const registerRoutes = (app: Koa) => {
    const router = new Router();

    registerSitemapRoutes(router);
    registerApiRoutes(router);

    app.use(router.routes())
        .use(router.allowedMethods());
};