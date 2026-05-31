import Router from '@koa/router';
import { attachRouter, getTrimmedQueryParam, requireAdmin } from '../../util/koa.js';
import { RouteBuilder } from '../../../shared/models/koa.js';
import { getServices } from '../../../shared/services/registry.js';

export const registerAdminRoutes: RouteBuilder = (parent) => {
    const router = new Router({
        prefix: '/dev'
    });

    router.post('/refresh', requireAdmin, async ctx => {
        const forceUseNextWeek = getTrimmedQueryParam(ctx, 'next') === 'true';
        getServices().data.cafe.refreshWeeklyMenus({ forceUseNextWeek });
        ctx.status = 200;
        ctx.body = 'Refresh Started';
    });

    attachRouter(parent, router);
};
