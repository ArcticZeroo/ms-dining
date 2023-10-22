import Koa from 'koa';
import mount from 'koa-mount';
import serve from 'koa-static';
import { serverStaticPath } from '../constants/config.js';

export const createStaticRoutingApp = () => {
    const app = new Koa();

    app.use(mount('/', serve(serverStaticPath)));
    app.use((ctx) => {
        ctx.throw(404, 'Resource not found');
    });

    return app;
}