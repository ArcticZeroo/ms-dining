import Router from '@koa/router';
import { attachRouter, getTrimmedQueryParam } from '../../util/koa.js';
import { RouteBuilder } from '../../models/koa.js';
import { getDevKey } from '../../constants/env.js';
import { Middleware } from 'koa';
import { updateWeeklyCafeMenus } from '../../api/cafe/cache/weekly.js';

export const registerDevRoutes: RouteBuilder = (parent) => {
	const router = new Router({
		prefix: '/dev'
	});

	const requireDevKey: Middleware = async (ctx, next) => {
		const key = getTrimmedQueryParam(ctx, 'key');
		if (key !== getDevKey()) {
			return ctx.throw(403, 'Invalid dev key');
		}

		await next();
	}

	router.get('/refresh', requireDevKey, async ctx => {
		const forceUseNextWeek = getTrimmedQueryParam(ctx, 'next') === 'true';
		updateWeeklyCafeMenus(forceUseNextWeek);
		ctx.status = 200;
		ctx.body = 'Refresh Started';
	});

	attachRouter(parent, router);
};
