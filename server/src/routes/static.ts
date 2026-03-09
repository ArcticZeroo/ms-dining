import Koa from 'koa';
import mount from 'koa-mount';
import serve from 'koa-static';
import send from 'koa-send';
import { serverStaticPath } from '../constants/config.js';
import Duration from '@arcticzeroo/duration';
import Router from '@koa/router';
import { attachRouter, CATCH_ALL_PATH } from '../util/koa.js';
import { MenuItemStorageClient } from '../api/storage/clients/menu-item.js';

export const createStaticRoutingApp= () => {
	const app = new Koa();

	const router = new Router();

	// Intercept thumbnail requests for deduplication redirects
	router.get('/menu-items/thumbnail/:filename', async (ctx, next) => {
		const id = ctx.params['filename']!.replace('.png', '');

		const canonicalId = MenuItemStorageClient.getCanonicalThumbnailId(id);
		if (canonicalId != null) {
			// Serve the canonical file directly instead of redirecting
			await send(ctx, `menu-items/thumbnail/${canonicalId}.png`, { root: serverStaticPath });
			return;
		}

		await next();
	});

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