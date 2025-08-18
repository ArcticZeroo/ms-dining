import Koa from 'koa';
import mount from 'koa-mount';
import serve from 'koa-static';
import { serverStaticPath } from '../constants/config.js';
import Duration from '@arcticzeroo/duration';

export const createStaticRoutingApp = () => {
	const app = new Koa();

	app.use(mount(
		'/',
		serve(serverStaticPath, {
			// Assume that most thumbnails are rarely being updated
			maxAge: new Duration({ days: 30 }).inMilliseconds
		})
	));

	app.use((ctx) => {
		ctx.throw(404, 'Resource not found');
	});

	return app;
}