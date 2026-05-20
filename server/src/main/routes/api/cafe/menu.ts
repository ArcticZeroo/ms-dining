import Router from '@koa/router';
import { memoizeResponseBody } from '../../../middleware/cache.js';
import { attachRouter } from '../../../util/koa.js';
import { getServices } from '../../../services/registry.js';
import { registerViewRoutes } from './menu/view.js';
import { registerReviewRoutes } from './menu/reviews/index.js';

export const registerMenuRoutes = (parent: Router) => {
    const router = new Router({
        prefix: '/menu'
    });

    router.get('/search-ideas',
        memoizeResponseBody({ isPublic: true }),
        async ctx => {
            ctx.body = await getServices().data.menuItem.getTopSearchTags({});
        });

	registerReviewRoutes(router);
	registerViewRoutes(router);

    attachRouter(parent, router);
};