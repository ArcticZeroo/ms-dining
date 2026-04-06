import Koa from 'koa';
import { TELEMETRY_CLIENT } from '../api/telemetry/app-insights.js';
import { getVisitorId } from './analytics.js';
import { getNamespaceLogger } from '../util/log.js';

const logger = getNamespaceLogger('AppInsights');
let hasLoggedFirstTrack = false;

export const appInsightsMiddleware: Koa.Middleware = async (ctx, next) => {
    if (TELEMETRY_CLIENT == null) {
        return next();
    }

    const startMs = Date.now();

    await next();

    const durationMs = Date.now() - startMs;
    const routePattern = (ctx as { _matchedRoute?: string })._matchedRoute as string | undefined;
	const route = routePattern ?? ctx.path;

    TELEMETRY_CLIENT.trackRequest({
        name:       `${ctx.method} ${route}`,
        url:        ctx.href,
        duration:   durationMs,
        resultCode: String(ctx.status),
        success:    ctx.status < 400,
        properties: {
            visitorId:  getVisitorId(ctx) || 'anonymous',
            method:     ctx.method,
            route:      route,
        },
    });

    if (!hasLoggedFirstTrack) {
        hasLoggedFirstTrack = true;
        logger.info(`First trackRequest called: ${ctx.method} ${route} (${ctx.status})`);
    }
};
