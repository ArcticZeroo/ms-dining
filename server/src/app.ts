import Koa from 'koa';
import json from 'koa-json';
import { registerRoutes } from './routes/register.js';
import serve from 'koa-static';
import { clientFolderDistPath, clientIndexHtmlPath, serverStaticPath } from './constants/config.js';
import mount from 'koa-mount';
import bodyParser from 'koa-bodyparser';
import { createStaticRoutingApp } from './routes/static.js';
import { sendUniversalVisitMiddleware } from './middleware/analytics.js';
import { serveSpaHtmlRoute } from './middleware/static.js';
import Router from '@koa/router';
import { attachRouter } from './util/koa.js';
import path from 'path';
import passport from 'koa-passport';
import { getSessionSecret, hasEnvironmentVariable, WELL_KNOWN_ENVIRONMENT_VARIABLES } from './constants/env.js';
import session from 'koa-session';

const app = new Koa();

if (hasEnvironmentVariable(WELL_KNOWN_ENVIRONMENT_VARIABLES.sessionSecret)) {
	app.keys = [getSessionSecret()];
	app.use(session({}, app));
}

app.use(passport.initialize());
app.use(passport.session());

app.use(json());
app.use(bodyParser());
app.use(sendUniversalVisitMiddleware);

registerRoutes(app);

app.use(mount('/.well-known', serve(path.join(serverStaticPath, '.well-known'))));
app.use(mount('/static', createStaticRoutingApp()));
app.use(mount('/', serve(clientFolderDistPath)));

const spaRouter = new Router();
spaRouter.get('(.*)', serveSpaHtmlRoute(clientIndexHtmlPath));
attachRouter(app, spaRouter);

export { app };