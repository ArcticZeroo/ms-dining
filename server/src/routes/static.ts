import Koa from 'koa';
import mount from 'koa-mount';
import serve from 'koa-static';
import { serverStaticPath } from '../constants/config.js';
import Duration from '@arcticzeroo/duration';
import Router from '@koa/router';
import { attachRouter, CATCH_ALL_PATH } from '../util/koa.js';

export const createStaticRoutingApp = () => {
	const app = new Koa();

	const router = new Router();

	router.use(mount(
		'/',
		serve(serverStaticPath, {
			// Assume that most thumbnails are rarely being updated
			maxAge: new Duration({ days: 30 }).inMilliseconds
		})
	));

	router.all(CATCH_ALL_PATH, (ctx) => {
		ctx.throw(404, 'Resource not found');
	});

	attachRouter(app, router);

	return app;
}