import Router, { RouterContext } from '@koa/router';
import Koa, { Middleware } from 'koa';
import { VERSION_TAG, VERSION_TAG_HEADER } from '@msdining/common/constants/versions';
import { IServerSearchResult } from '../../shared/models/search.js';
import { ISearchResponseResult } from '@msdining/common/models/http';
import { SearchEntityType } from '@msdining/common/models/search';
import { getStationLogoUrl, resolveViewToCafes } from '../../shared/util/cafe.js';
import { jsonStringifyWithoutNull } from '../../shared/util/serde.js';
import { getDevKey } from '../../shared/constants/env.js';
import { IServerUser } from '../../shared/models/auth.js';
import Duration, { DurationOrMilliseconds } from '@arcticzeroo/duration';
import { ICafe } from '../../shared/models/cafe.js';
import { getDateStringForMenuRequest } from './date.js';
import { getServices } from '../../shared/services/registry.js';
import { setTelemetryProperties } from '../middleware/telemetry.js';

export const attachRouter = (parent: Koa | Router, child: Router) => {
    // Have to cast parent to Router or else TS gets mad that they have different `use` definitions.
    (parent as Router).use(child.routes()).use(child.allowedMethods());
}

export const getTrimmedQueryParam = (ctx: Koa.Context, key: string): string | undefined => {
    const value = ctx.query[key];

    if (!value || typeof value !== 'string') {
        return undefined;
    }

    const trimmedValue = value.trim();
    return trimmedValue || undefined;
}

export const getMaybeNumberQueryParam = (ctx: Koa.Context, key: string): number | undefined => {
    const value = ctx.query[key];

    if (!value || typeof value !== 'string') {
        return undefined;
    }

    const numberValue = Number(value);

    if (Number.isNaN(numberValue)) {
        return undefined;
    }

    return numberValue;
}

const parseVersionTag = (ctx: Koa.Context) => {
    const tagRaw = ctx.get(VERSION_TAG_HEADER);

    if (tagRaw) {
        const tag = Number(tagRaw);
        if (!Number.isNaN(tag)) {
            return tag;
        }
    }

    return VERSION_TAG.unknown;
}

export const getVersionTag = (ctx: Koa.Context): number => {
    if (typeof ctx.state.versionTag !== 'number' || Number.isNaN(ctx.state.versionTag)) {
        ctx.state.versionTag = parseVersionTag(ctx);
    }

    return ctx.state.versionTag;
}

export const supportsVersionTag = (ctx: Koa.Context, tag: number) => getVersionTag(ctx) >= tag;

export const serializeMapOfStringToSet = (deserialized: Map<string, Set<string>>) => {
    const serialized: Record<string /*cafeId*/, Array<string>> = {};
    for (const [cafeId, dates] of deserialized.entries()) {
        serialized[cafeId] = Array.from(dates);
    }
    return serialized;
};

const serializeSearchResult = async (id: string, searchResult: IServerSearchResult): Promise<ISearchResponseResult> => {
    const matchReasons = new Set(searchResult.matchReasons);

    const imageUrl = typeof searchResult.imageUrl === 'function'
        ? await searchResult.imageUrl()
        : searchResult.imageUrl;

    let overallRating: number | undefined;
    let totalReviewCount: number | undefined;

    if (searchResult.type === SearchEntityType.menuItem) {
        const reviewHeader = await getServices().data.review.retrieveReviewHeaderByParts({
            groupId: searchResult.groupId,
            name: searchResult.name,
        });
        if (reviewHeader.totalReviewCount > 0) {
            overallRating = reviewHeader.overallRating;
            totalReviewCount = reviewHeader.totalReviewCount;
        }
    } else if (searchResult.type === SearchEntityType.station) {
        const reviewHeader = await getServices().data.review.retrieveStationReviewHeaderByParts({
            groupId: searchResult.groupId,
            name: searchResult.name,
        });
        if (reviewHeader.totalReviewCount > 0) {
            overallRating = reviewHeader.overallRating;
            totalReviewCount = reviewHeader.totalReviewCount;
        }
    }

    return ({
        id,
        type:             searchResult.type,
        name:             searchResult.name,
        description:      searchResult.description || undefined,
        imageUrl:         getStationLogoUrl(searchResult.name, imageUrl) || undefined,
        locations:        serializeMapOfStringToSet(searchResult.locationDatesByCafeId),
        prices:           Object.fromEntries(searchResult.priceByCafeId),
        stations:         Object.fromEntries(searchResult.stationByCafeId),
        tags:             searchResult.tags ? Array.from(searchResult.tags) : undefined,
        searchTags:       searchResult.searchTags ? Array.from(searchResult.searchTags) : undefined,
        matchedModifiers: serializeMapOfStringToSet(searchResult.matchedModifiers),
        matchReasons:     Array.from(matchReasons),
        vectorDistance:   searchResult.vectorDistance,
        cafeId:           searchResult.cafeId || undefined,
        overallRating,
        totalReviewCount,
        entityKey:        searchResult.entityKey,
    });
};

export const serializeSearchResults = async (ctx: Koa.Context, searchResultsByIdPerEntityType: Map<SearchEntityType, Map<string, IServerSearchResult>>) => {
    const searchResultPromises: Array<Promise<ISearchResponseResult>> = [];

    for (const searchResultsById of searchResultsByIdPerEntityType.values()) {
        for (const [id, searchResult] of searchResultsById.entries()) {
            searchResultPromises.push(serializeSearchResult(id, searchResult));
        }
    }

    setTelemetryProperties(ctx, { resultCount: String(searchResultPromises.length) });

    ctx.body = jsonStringifyWithoutNull(await Promise.all(searchResultPromises));
};

export const requireDevKey: Middleware = async (ctx, next) => {
    const key = getTrimmedQueryParam(ctx, 'key');
    if (key !== getDevKey()) {
        return ctx.throw(403, 'Invalid dev key');
    }

    await next();
}

export const requireRole = (role: string): Middleware => {
    return async (ctx, next) => {
        if (!ctx.isAuthenticated()) {
            return ctx.throw(401, 'User not authenticated');
        }

        const userId = ctx.state.user;
        const user = await getServices().data.user.getUser({ id: userId });

        if (!user) {
            return ctx.throw(500, 'User not found');
        }

        if (user.role !== role) {
            return ctx.throw(403, `User does not have the required role: ${role}`);
        }

        await next();
    }
}

export const requireAdmin = requireRole('admin');

export const getEntityTypeAndName = (ctx: Koa.Context): [SearchEntityType, string] => {
    const entityTypeRaw = getTrimmedQueryParam(ctx, 'type');
    const entityName = getTrimmedQueryParam(ctx, 'name');

    if (!entityTypeRaw || !entityName) {
        ctx.throw(400, 'Missing type or id');
    }

    const entityType = SearchEntityType[entityTypeRaw as keyof typeof SearchEntityType];
    if (!entityType) {
        ctx.throw(400, 'Invalid entityType');
    }

    return [entityType, entityName];
}

export const getMaybeUserId = (ctx: Koa.Context): string | null => {
    const userId = ctx.state.user;

    if (!userId || typeof userId !== 'string') {
        return null;
    }

    return userId;
}

export const getUserIdOrThrow = (ctx: Koa.Context): string => {
    if (!ctx.isAuthenticated()) {
        ctx.throw(401, 'User not authenticated');
    }

    const userId = ctx.state.user;
    if (!userId) {
        ctx.throw(500, 'User ID not found in session');
    }

    return userId;
}

export const getUserOrThrowAsync = async (ctx: Koa.Context): Promise<IServerUser> => {
    const id = getUserIdOrThrow(ctx);

    const user = await getServices().data.user.getUser({ id });

    if (!user) {
        ctx.throw(500, 'User not found');
    }

    return user;
}

export const isAdminAsync = async (ctx: Koa.Context): Promise<boolean> => {
    const userId = getMaybeUserId(ctx);
    if (!userId) {
        return false;
    }

    const user = await getServices().data.user.getUser({ id: userId });
    return user?.role === 'admin';
}

export const assignCacheControl = (ctx: Koa.Context, maxAge: DurationOrMilliseconds, isPublic: boolean = false) => {
    ctx.set('Cache-Control', `${isPublic ? 'public' : 'private'}, max-age=${Duration.fromDurationOrMilliseconds(maxAge).inSeconds}`);
    ctx.set('Vary', VERSION_TAG_HEADER);
}

export const CATCH_ALL_PATH = '{*path}';

const getCafeIdFromRequest = (ctx: RouterContext): string => {
    const id = ctx.params.id?.toLowerCase();
    if (!id) {
        ctx.throw(400, 'Missing cafe id');
    }
    return id;
}

const getCafeFromRequest = async (ctx: RouterContext) => {
    const id = getCafeIdFromRequest(ctx);
    const cafe = await getServices().data.cafe.retrieveCafe({ id });
    if (!cafe) {
        ctx.throw(404, 'Cafe not found or data is missing');
    }

    return cafe;
}

export const validateCafeMenuAccessAsync = async (ctx: RouterContext, onReady: (cafe: ICafe, dateString: string) => Promise<void>) => {
    const cafe = await getCafeFromRequest(ctx);

    const dateString = getDateStringForMenuRequest(ctx);
    if (dateString == null) {
        ctx.body = JSON.stringify([]);
        return;
    }

    return onReady(cafe, dateString);
};

export const validateViewMenuAccessAsync = async (ctx: RouterContext, onReady: (cafes: ICafe[], dateString: string) => Promise<void>) => {
    const id = getCafeIdFromRequest(ctx);

    const cafes = resolveViewToCafes(id);
    if (!cafes) {
        ctx.throw(404, 'View not found');
    }

    const dateString = getDateStringForMenuRequest(ctx);
    if (dateString == null) {
        ctx.body = JSON.stringify([]);
        return;
    }

    return onReady(cafes, dateString);
}
