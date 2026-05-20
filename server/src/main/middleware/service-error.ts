import { Middleware } from 'koa';
import { logError } from '../../util/log.js';
import { ServiceError, ServiceErrorCode } from '../../worker-rpc/errors.js';

/**
 * HTTP status returned for each {@link ServiceErrorCode}. Centralizing this
 * mapping is the whole reason `ServiceError` exists: routes and services
 * throw a typed error; the middleware decides what the wire looks like.
 *
 * Updating: if you add a code to `ServiceErrorCode`, TypeScript will fail
 * the build here until you map it — that's the point.
 */
const HTTP_STATUS_BY_CODE: Record<ServiceErrorCode, number> = {
    NOT_FOUND:     404,
    BAD_REQUEST:   400,
    UNAUTHORIZED:  401,
    FORBIDDEN:     403,
    CONFLICT:      409,
    RATE_LIMITED:  429,
    UPSTREAM_FAIL: 502,
    INTERNAL:      500,
};

/**
 * Translates `ServiceError` (raised from inside a service method, including
 * the eventual worker-thread implementations) into an HTTP response with the
 * matching status code and a structured JSON body the client can read.
 *
 * Other thrown values pass through unchanged so existing error handlers
 * (BoD translator, koa default) still see them.
 */
export const serviceErrorMiddleware: Middleware = async (ctx, next) => {
    try {
        await next();
    } catch (err) {
        if (err instanceof ServiceError) {
            const status = HTTP_STATUS_BY_CODE[err.code];
            // INTERNAL errors are surprises — log them so they show up in
            // dev/prod telemetry. Categorical errors (NOT_FOUND, etc.) are
            // expected control flow and don't need a log line.
            if (err.code === 'INTERNAL') {
                logError(`Unhandled ServiceError on ${ctx.method} ${ctx.path}:`, err);
            }
            ctx.status = status;
            ctx.type = 'application/json';
            ctx.body = {
                code:    err.code,
                message: err.message,
                ...(err.details !== undefined ? { details: err.details } : {}),
            };
            return;
        }
        throw err;
    }
};
