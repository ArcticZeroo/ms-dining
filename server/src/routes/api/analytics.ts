import Router from '@koa/router';
import { attachRouter } from '../../util/koa.js';
import { RouteBuilder } from '../../models/koa.js';
import { getVisitsAsync } from '../../api/tracking/visitors.js';
import { ANALYTICS_APPLICATION_NAMES, getApplicationNameForScenario } from '@msdining/common/dist/constants/analytics.js';

export const registerAnalyticsRoutes: RouteBuilder = (parent) => {
    const router = new Router({
        prefix: '/analytics'
    });

    router.get('/visits', async ctx => {
        const scenario = ctx.query.scenario;
        const daysAgoString = ctx.query.days;

        if (!daysAgoString || typeof daysAgoString !== 'string') {
            return ctx.throw(400, 'Invalid/missing days ago');
        }

        const daysAgo = Number(daysAgoString);
        if (Number.isNaN(daysAgo)) {
            return ctx.throw(400, 'Days ago is not a number');
        }

        const applicationId = typeof scenario === 'string'
            ? getApplicationNameForScenario(scenario)
            : ANALYTICS_APPLICATION_NAMES.primary;

        ctx.body = await getVisitsAsync(applicationId, daysAgo);
    });

    attachRouter(parent, router);
};