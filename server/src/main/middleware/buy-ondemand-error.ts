import { Middleware } from 'koa';
import { BuyOnDemandError } from '../../api/cafe/buy-ondemand/buy-ondemand-error.js';
import { logError } from '../../shared/util/log.js';

/**
 * Translates `BuyOnDemandError` (raised when an upstream BoD response carried
 * a translatable error code, e.g. `CONCEPTS_NOT_AVAILABLE`) into an HTTP 502
 * JSON body the client can render directly. Other errors propagate unchanged.
 *
 * 502 (Bad Gateway) communicates "upstream BoD failed" without falsely
 * implying the user did something wrong — most BoD 4xx responses are actually
 * driven by our request shape, not the user's input.
 */
export const formatBuyOnDemandErrors: Middleware = async (ctx, next) => {
    try {
        await next();
    } catch (err) {
        if (err instanceof BuyOnDemandError) {
            logError(`BuyOnDemandError on ${ctx.method} ${ctx.path}: ${err.rawCode} (BoD status ${err.httpStatus})`);
            ctx.status = 502;
            ctx.type = 'application/json';
            ctx.body = {
                message: err.userMessage,
                code:    err.rawCode,
            };
            return;
        }
        throw err;
    }
};
