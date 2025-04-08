import Duration from '@arcticzeroo/duration';
import Koa from 'koa';
import { getVersionTag } from '../util/koa.js';

interface ICacheEntry {
    expirationTime: number;
    value: string;
}

const DEFAULT_CACHE_EXPIRATION_TIME = new Duration({ minutes: 30 });

class ExpiringCache {
    #cache = new Map<string, ICacheEntry>;
    #expirationTime: Duration;

    constructor(expirationTime = DEFAULT_CACHE_EXPIRATION_TIME) {
        this.#expirationTime = expirationTime;
        setInterval(() => this.#purgeExpiredEntries(), expirationTime.inMilliseconds * 2);
    }

    #purgeExpiredEntries() {
        const now = Date.now();
        for (const [key, cacheEntry] of this.#cache.entries()) {
            if (cacheEntry.expirationTime < now) {
                this.#cache.delete(key);
            }
        }
    }

    getValue(key: string) {
        const entry = this.#cache.get(key);

        if (entry == null || Date.now() > entry.expirationTime) {
            this.#cache.delete(key);
            return undefined;
        }

        return entry.value;
    }

    insertEntry(key: string, value: string) {
        this.#cache.set(key, {
            expirationTime: Date.now() + this.#expirationTime.inMilliseconds,
            value
        });
    }

    deleteEntry(key: string) {
        this.#cache.delete(key);
    }

    clearAllEntries() {
        this.#cache.clear();
    }
}

interface IMemoizeController extends Koa.Middleware {
    clearCache(ctx?: Koa.Context): void;
}

export const memoizeResponseBodyByQueryParams = (expirationTime = DEFAULT_CACHE_EXPIRATION_TIME): IMemoizeController => {
    const cache = new ExpiringCache(expirationTime);

    const serializeQueryParams = (ctx: Koa.Context) => {
        const queryParams = ctx.query;
        const queryParamsKeys = Object.keys(queryParams).sort();

        if (queryParamsKeys.length === 0) {
            return '';
        }

        return queryParamsKeys.map(key => `${key}=${queryParams[key]}`).join('&');
    }

    const getCacheKey = (ctx: Koa.Context) => `${ctx.path}@${getVersionTag(ctx)}?${serializeQueryParams(ctx)}`;

    const middleware: Koa.Middleware = async (ctx, next) => {
        const cacheKey = getCacheKey(ctx);
        const cachedBody = cache.getValue(cacheKey);

        if (cachedBody != null) {
            ctx.body = cachedBody;
            return;
        }

        await next();

        if (ctx.body && ctx.status === 200) {
            cache.insertEntry(cacheKey, ctx.body);
        }
    };

    (middleware as IMemoizeController).clearCache = (ctx) => {
        if (ctx) {
            cache.deleteEntry(getCacheKey(ctx));
        } else {
            cache.clearAllEntries();
        }
    };

    return middleware as IMemoizeController;
}