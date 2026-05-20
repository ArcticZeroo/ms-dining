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
import { serviceErrorMiddleware } from './middleware/service-error.js';
import { dbPriorityMiddleware } from './middleware/db-priority.js';
import { appInsightsMiddleware } from './middleware/telemetry.js';
import { runWithServices } from './services/registry.js';
import type { Services } from './services/types.js';

/**
 * Builds the Koa app, scoping every request inside an AsyncLocalStorage
 * services context. Production wires this with `createProductionServices()`;
 * integration tests pass their per-context test services so HTTP requests
 * resolve `getServices()` to the test mocks.
 */
export const createApp = (services: Services): Koa => {
    // Validate session secret early — fail fast at boot rather than at first
    // session use. (Used to be a module-load-time check; same intent.)
    if (!hasEnvironmentVariable(WELL_KNOWN_ENVIRONMENT_VARIABLES.sessionSecret)) {
        throw new Error('Session secret environment variable is not set. Please set the SESSION_SECRET environment variable.');
    }

    const app = new Koa();

    // FIRST middleware: every request runs inside the services scope so any
    // downstream handler (including subsequent middleware, route handlers, and
    // any async work they spawn) sees `getServices()` resolved to the per-app
    // services. Tests pass `createApp(ctx.services)` — same mechanism.
    app.use((_ctx, next) => runWithServices(services, () => next()));

    // Set DB priority to 'normal' for all HTTP requests (before any DB-touching middleware)
    app.use(dbPriorityMiddleware);

    // Do this first so that this isn't impacted by auth/doesn't send telemetry
    app.use(mount('/.well-known', serve(path.join(serverStaticPath, '.well-known'))));
    app.use(mount('/static', createStaticRoutingApp()));

    app.keys = [getSessionSecret()];
    app.use(session({
        maxAge: new Duration({ days: 180 }).inMilliseconds,
        renew: true,
        store: new PrismaSessionStore()
    }, app));

    app.use(passport.initialize());
    app.use(passport.session());

    app.use(json());
    app.use(bodyParser());
    app.use(sendUniversalVisitMiddleware);
    app.use(treatZodErrorsAsBadRequest);
    app.use(formatBuyOnDemandErrors);
    app.use(serviceErrorMiddleware);
    app.use(appInsightsMiddleware);

    registerRoutes(app);

    // Mostly to get assets included for free
    app.use(mount('/', serve(clientFolderDistPath)));

    const spaRouter = new Router();
    spaRouter.get(CATCH_ALL_PATH, serveSpaHtmlRoute(clientIndexHtmlPath));
    attachRouter(app, spaRouter);

    return app;
};
