import Koa from 'koa';
import mount from 'koa-mount';
import serve from 'koa-static';
import { serverStaticPath } from '../constants/config.js';
import Duration from '@arcticzeroo/duration';
import Router from '@koa/router';
import { attachRouter, CATCH_ALL_PATH } from '../util/koa.js';
import { MenuItemStorageClient } from '../api/storage/clients/menu-item.js';

const THUMBNAIL_PATH_PREFIX = '/menu-items/thumbnail/';

export const createStaticRoutingApp = () => {
	const app = new Koa();

	const router = new Router();

	// Intercept thumbnail requests for deduplication redirects
	router.use(async (ctx, next) => {
		if (ctx.path.startsWith(THUMBNAIL_PATH_PREFIX)) {
			const filename = ctx.path.slice(THUMBNAIL_PATH_PREFIX.length);
			const id = filename.replace('.png', '');

			const canonicalId = MenuItemStorageClient.getCanonicalThumbnailId(id);
			if (canonicalId != null) {
				ctx.redirect(`${THUMBNAIL_PATH_PREFIX}${canonicalId}.png`);
				ctx.status = 302;
				return;
			}
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