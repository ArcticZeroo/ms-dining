import Router from '@koa/router';
import { generateSitemap } from '../api/sitemap.js';
import { streamToPromise } from 'sitemap';

export const registerSitemapRoutes = (router: Router) => {
    router.get('/sitemap.xml', async (ctx) => {
        const sitemap = generateSitemap();
        ctx.type = 'xml';
        ctx.body = (await streamToPromise(sitemap)).toString('utf-8');
    });
}