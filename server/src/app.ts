import Koa from 'koa';
import json from 'koa-json';
import { registerRoutes } from './routes/register.js';
import serve from 'koa-static';
import { clientFolderDistPath, clientIndexHtmlPath, serverStaticPath } from './constants/config.js';
import mount from 'koa-mount';
import bodyParser from 'koa-bodyparser';
import { createStaticRoutingApp } from './routes/static.js';
import { sendVisitorAnalytics } from './middleware/tracking.js';
import { serveSpaHtmlRoute } from './middleware/static.js';
import Router from '@koa/router';
import { attachRouter } from './util/koa.js';

const app = new Koa();

app.use(json());
app.use(bodyParser());
app.use(sendVisitorAnalytics);

registerRoutes(app);

app.use(mount('/static', createStaticRoutingApp()));
app.use(mount('/', serve(clientFolderDistPath)));

const spaRouter = new Router();
spaRouter.get('(.*)', serveSpaHtmlRoute(clientIndexHtmlPath));
attachRouter(app, spaRouter);

export { app };