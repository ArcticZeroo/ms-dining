import Duration from '@arcticzeroo/duration';
import Koa from 'koa';

interface ICacheEntry {
    expirationTime: number;
    value: string;
}

const DEFAULT_CACHE_EXPIRATION_TIME = new Duration({ minutes: 30 });

export const memoizeResponseBodyByQueryParams = (cacheExpirationTime: Duration = DEFAULT_CACHE_EXPIRATION_TIME): Koa.Middleware => {
    const cacheByQueryParams = new Map<string, ICacheEntry>();

    const serializeQueryParams = (ctx: Koa.Context) => {
        const queryParams = ctx.query;
        const queryParamsKeys = Object.keys(queryParams).sort();

        if (queryParamsKeys.length === 0) {
            return '';
        }

        return queryParamsKeys.map(key => `${key}=${queryParams[key]}`).join('&');
    }

    const getCacheKey = (ctx: Koa.Context) => `${ctx.path}?${serializeQueryParams(ctx)}`;

    setInterval(() => {
        const now = Date.now();
        for (const [key, cacheEntry] of cacheByQueryParams.entries()) {
            if (cacheEntry.expirationTime < now) {
                cacheByQueryParams.delete(key);
            }
        }
    }, cacheExpirationTime.inMilliseconds * 2);

    return async (ctx, next) => {
        const cacheKey = getCacheKey(ctx);
        const cacheEntry = cacheByQueryParams.get(cacheKey);

        const now = Date.now();

        if (cacheEntry != null && cacheEntry.expirationTime > now) {
            ctx.body = cacheEntry.value;
            return;
        }

        await next();

        if (ctx.body && ctx.status === 200) {
            cacheByQueryParams.set(cacheKey, {
                expirationTime: now + cacheExpirationTime.inMilliseconds,
                value: ctx.body
            });
        }
    }
}