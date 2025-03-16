import Router from '@koa/router';
import { attachRouter, getTrimmedQueryParam, requireDevKey } from '../../util/koa.js';
import { RouteBuilder } from '../../models/koa.js';
import { updateWeeklyCafeMenus } from '../../api/cafe/cache/weekly.js';

export const registerDevRoutes: RouteBuilder = (parent) => {
	const router = new Router({
		prefix: '/dev'
	});

	router.get('/refresh', requireDevKey, async ctx => {
		const forceUseNextWeek = getTrimmedQueryParam(ctx, 'next') === 'true';
		updateWeeklyCafeMenus(forceUseNextWeek);
		ctx.status = 200;
		ctx.body = 'Refresh Started';
	});

	attachRouter(parent, router);
};
