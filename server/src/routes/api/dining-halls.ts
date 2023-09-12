import Router from '@koa/router';
import { diningHalls } from '../../constants/dining-halls.js';
import { attachRouter } from '../../util/koa.js';

export const registerDiningHallRoutes = (parent: Router) => {
    const router = new Router({
        prefix: '/dining'
    });

    router.get('/', async (ctx) => {
        ctx.body = JSON.stringify(diningHalls);
    });

    attachRouter(parent, router);
};