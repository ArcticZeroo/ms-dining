import Router from '@koa/router';
import { registerApiRoutes } from './api/routes.js';
import Koa from 'koa';

export const registerRoutes = (app: Koa) => {
    const router = new Router();

    registerApiRoutes(router);

    app.use(router.routes())
        .use(router.allowedMethods());
};