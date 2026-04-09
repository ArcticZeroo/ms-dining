import Koa from 'koa';
import { TELEMETRY_CLIENT } from '../api/telemetry/app-insights.js';
import { getVisitorId } from './analytics.js';
import { CATCH_ALL_PATH } from '../util/koa.js';

const TELEMETRY_PROPERTIES_KEY = 'telemetryProperties';

/**
 * Adds custom properties to the App Insights request telemetry for the current request.
 * Call from route handlers to attach contextual data (e.g. cafeId, searchQuery).
 */
export const setTelemetryProperties = (ctx: Koa.Context, properties: Record<string, string>) => {
    const existing = ctx.state[TELEMETRY_PROPERTIES_KEY] as Record<string, string> | undefined;
    ctx.state[TELEMETRY_PROPERTIES_KEY] = existing
        ? { ...existing, ...properties }
        : properties;
};

export const appInsightsMiddleware: Koa.Middleware = async (ctx, next) => {
    if (TELEMETRY_CLIENT == null) {
        return next();
    }

    const startMs = Date.now();
    let error: unknown;

    try {
        await next();
    } catch (err) {
        error = err;
        throw err;
    } finally {
        const durationMs = Date.now() - startMs;
        const routePattern = (ctx as { _matchedRoute?: string })._matchedRoute as string | undefined;
        const routeMatched = routePattern != null;
        const route = routePattern === CATCH_ALL_PATH ? '/' : (routePattern ?? ctx.path);
        const customProperties = ctx.state[TELEMETRY_PROPERTIES_KEY] as Record<string, string> | undefined;
        const resultCode = error ? String((error as { status?: number }).status || 500) : String(ctx.status);

        TELEMETRY_CLIENT.trackRequest({
            name:       `${ctx.method} ${route}`,
            url:        ctx.href,
            duration:   durationMs,
            resultCode,
            success:    Number(resultCode) < 400,
            properties: {
                visitorId:    getVisitorId(ctx) || 'anonymous',
                method:       ctx.method,
                route:        route,
                routeMatched: String(routeMatched),
                ...customProperties,
            },
        });
    }
};
