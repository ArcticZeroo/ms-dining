import Router from '@koa/router';
import { registerApiRoutes } from './api/routes.js';

export const registerRoutes = (app) => {
    const router = new Router();

    registerApiRoutes(router);

    app.use(router.routes())
        .use(router.allowedMethods());
};