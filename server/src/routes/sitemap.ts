import Router from '@koa/router';
import { generateSitemap } from '../api/sitemap.js';

export const registerSitemapRoutes = (router: Router) => {
    router.get('/sitemap.xml', async (ctx) => {
        const sitemap = generateSitemap();
        ctx.respond = false;
        sitemap.pipe(ctx.res);
    });
}