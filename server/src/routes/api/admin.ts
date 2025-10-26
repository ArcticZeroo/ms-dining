import Router from '@koa/router';
import { attachRouter, getTrimmedQueryParam, requireAdmin } from '../../util/koa.js';
import { RouteBuilder } from '../../models/koa.js';
import { updateWeeklyCafeMenus } from '../../api/cafe/job/weekly.js';

export const registerAdminRoutes: RouteBuilder = (parent) => {
	const router = new Router({
		prefix: '/dev'
	});

	router.post('/refresh', requireAdmin, async ctx => {
		const forceUseNextWeek = getTrimmedQueryParam(ctx, 'next') === 'true';
		updateWeeklyCafeMenus(forceUseNextWeek);
		ctx.status = 200;
		ctx.body = 'Refresh Started';
	});

	attachRouter(parent, router);
};
