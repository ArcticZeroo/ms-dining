import Router from '@koa/router';
import { attachRouter } from '../../util/koa.js';
import { RouteBuilder } from '../../models/koa.js';
import { getVisitsAsync } from '../../api/tracking/visitors.js';

export const registerAnalyticsRoutes: RouteBuilder = (parent) => {
    const router = new Router({
        prefix: '/analytics'
    });

    router.get('/visits', async ctx => {
        const daysAgoString = ctx.query.days;

        if (!daysAgoString || typeof daysAgoString !== 'string') {
            return ctx.throw(400, 'Invalid/missing days ago');
        }

        const daysAgo = Number(daysAgoString);
        if (Number.isNaN(daysAgo)) {
            return ctx.throw(400, 'Days ago is not a number');
        }

        ctx.body = await getVisitsAsync(daysAgo);
    });

    attachRouter(parent, router);
};