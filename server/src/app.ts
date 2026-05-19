import Duration from '@arcticzeroo/duration';
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
import { attachRouter, CATCH_ALL_PATH } from './util/koa.js';
import path from 'path';
import passport from 'koa-passport';
import { getSessionSecret, hasEnvironmentVariable, WELL_KNOWN_ENVIRONMENT_VARIABLES } from './constants/env.js';
import session from 'koa-session';
import { PrismaSessionStore } from './util/session-store.js';
import { treatZodErrorsAsBadRequest } from './middleware/zod.js';
import { formatBuyOnDemandErrors } from './middleware/buy-ondemand-error.js';
import { dbPriorityMiddleware } from './middleware/db-priority.js';
import { appInsightsMiddleware } from './middleware/telemetry.js';
import { oneShot } from './util/boot-diagnostics.js';

const app = new Koa();

const traced = (name: string, middleware: Koa.Middleware): Koa.Middleware => {
    const wrapped = oneShot(`mw:${name}`, middleware);
    return (ctx, next) => wrapped(ctx, next);
};

// Set DB priority to 'normal' for all HTTP requests (before any DB-touching middleware)
app.use(traced('dbPriority', dbPriorityMiddleware));

// Do this first so that this isn't impacted by auth/doesn't send telemetry
app.use(mount('/.well-known', serve(path.join(serverStaticPath, '.well-known'))));
app.use(mount('/static', createStaticRoutingApp()));

// If we don't initialize the session, everything else fails later
if (!hasEnvironmentVariable(WELL_KNOWN_ENVIRONMENT_VARIABLES.sessionSecret)) {
    throw new Error('Session secret environment variable is not set. Please set the SESSION_SECRET environment variable.');
}

app.keys = [getSessionSecret()];
app.use(traced('session', session({
    maxAge: new Duration({ days: 180 }).inMilliseconds,
    renew: true,
    store: new PrismaSessionStore()
}, app)));

app.use(traced('passport.initialize', passport.initialize()));
app.use(traced('passport.session', passport.session()));

app.use(traced('json', json()));
app.use(traced('bodyParser', bodyParser()));
app.use(traced('sendUniversalVisit', sendUniversalVisitMiddleware));
app.use(traced('zodErrors', treatZodErrorsAsBadRequest));
app.use(traced('buyOnDemandErrors', formatBuyOnDemandErrors));
app.use(traced('appInsights', appInsightsMiddleware));

registerRoutes(app);

// Mostly to get assets included for free
app.use(mount('/', serve(clientFolderDistPath)));

const spaRouter = new Router();
spaRouter.get(CATCH_ALL_PATH, serveSpaHtmlRoute(clientIndexHtmlPath));
attachRouter(app, spaRouter);

export { app };