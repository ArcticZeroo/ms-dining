import Router from '@koa/router';
import { attachRouter } from '../../util/koa.js';
import { RouteBuilder } from '../../models/routes.js';
import Duration from '@arcticzeroo/duration';
import { afterRegex, getVisitsAsync } from '../../api/tracking/visitors.js';

const maxTimeForVisits = new Duration({ days: 35 });

export const registerAnalyticsRoutes: RouteBuilder = (parent) => {
    const router = new Router({
        prefix: '/analytics'
    });

    router.get('/visits', async ctx => {
        const afterTimestamp = ctx.query.after;

        if (!afterTimestamp) {
            return ctx.throw(400, 'Missing after timestamp');
        }

        if (typeof afterTimestamp !== 'string') {
            return ctx.throw(400, 'After timestamp is not a string');
        }

        if (!afterRegex.test(afterTimestamp)) {
            return ctx.throw(400, 'After timestamp is not in the correct format');
        }

        const afterDate = new Date(afterTimestamp);
        if (Number.isNaN(afterDate.getTime())) {
            return ctx.throw(400, 'After timestamp is not a valid date');
        }

        const timeFromNowMs = Date.now() - afterDate.getTime();

        if (timeFromNowMs < 0) {
            return ctx.throw(400, 'After timestamp is in the future');
        }

        if (timeFromNowMs > maxTimeForVisits.inMilliseconds) {
            return ctx.throw(400, 'After timestamp is too far in the past');
        }

        ctx.body = await getVisitsAsync(afterDate);
    });

    attachRouter(parent, router);
};