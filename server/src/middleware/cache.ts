import Duration, { DurationOrMilliseconds } from '@arcticzeroo/duration';
import Koa from 'koa';
import { assignCacheControl, getVersionTag } from '../util/koa.js';
import { CACHE_EVENTS } from '../api/storage/events.js';

interface ICacheEntry {
    expirationTime: number;
    value: string;
}

export const DEFAULT_CACHE_EXPIRATION_TIME = new Duration({ minutes: 30 });

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

	getEntry(key: string): ICacheEntry | undefined {
		const entry = this.#cache.get(key);
		if (entry == null || Date.now() > entry.expirationTime) {
			this.#cache.delete(key);
			return undefined;
		}
		return entry;
	}

    getValue(key: string) {
        return this.getEntry(key)?.value;
    }

	getExpirationTime(key: string): number | undefined {
		return this.#cache.get(key)?.expirationTime;
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
	getNextExpiryTime(ctx: Koa.Context): number | undefined;
}

interface IMemoizeResponseBodyByQueryParams {
	expirationTime?: DurationOrMilliseconds;
	isPublic?: boolean;
}

/**
 * Memoize the response body based on the request path and query parameters (including version tag).
 * Should not be used for any authenticated route.
 * @param expirationTime - how long to cache the response body
 * @param isPublic - whether to mark the response as public cacheable in the Cache-Control header
 */
export const memoizeResponseBody = ({ expirationTime = DEFAULT_CACHE_EXPIRATION_TIME, isPublic = false }: IMemoizeResponseBodyByQueryParams = {}): IMemoizeController => {
    const cache = new ExpiringCache(Duration.fromDurationOrMilliseconds(expirationTime));

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
		ctx.state.memoize = middleware;

        const cacheKey = getCacheKey(ctx);
        const cacheEntry = cache.getEntry(cacheKey);

        if (cacheEntry != null) {
			const remainingTimeMs = cacheEntry.expirationTime - Date.now();
			assignCacheControl(ctx, Math.floor(remainingTimeMs / 1000), isPublic);
            ctx.body = cacheEntry.value;
            return;
        }

        await next();

        if (ctx.body && ctx.status === 200) {
			assignCacheControl(ctx, DEFAULT_CACHE_EXPIRATION_TIME, isPublic);
            cache.insertEntry(cacheKey, ctx.body);
        }
    };

	const controller = middleware as IMemoizeController;

    controller.clearCache = (ctx) => {
        if (ctx) {
            cache.deleteEntry(getCacheKey(ctx));
        } else {
            cache.clearAllEntries();
        }
    };

	controller.getNextExpiryTime = (ctx: Koa.Context) => {
		const cacheKey = getCacheKey(ctx);
		return cache.getExpirationTime(cacheKey);
	};

    return middleware as IMemoizeController;
}

interface IMemoizeResponseBodyWithResetOnMenuUpdateParams extends IMemoizeResponseBodyByQueryParams {
	cafeId?: string;
	dateString?: string;
}

export const memoizeResponseBodyWithResetOnMenuUpdate = ({ cafeId, dateString, ...params }: IMemoizeResponseBodyWithResetOnMenuUpdateParams = {}) => {
	const controller = memoizeResponseBody(params);

	CACHE_EVENTS.on('menuPublished', (event) => {
		if ((cafeId && event.cafe.id !== cafeId) || (dateString && event.dateString !== dateString)) {
			return;
		}

		controller.clearCache();
	});

	return controller;
}

export const assignCacheControlMiddleware = (maxAge: DurationOrMilliseconds = DEFAULT_CACHE_EXPIRATION_TIME, isPublic: boolean = false) => {
	const maxAgeDuration = Duration.fromDurationOrMilliseconds(maxAge);

	return async (ctx: Koa.Context, next: Koa.Next) => {
		ctx.set('Cache-Control', `${isPublic ? 'public' : 'private'}, max-age=${maxAgeDuration.inSeconds}`);
		await next();
	};
}

export const doNotCacheMiddleware = async (ctx: Koa.Context, next: Koa.Next) => {
	ctx.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
	await next();
}