import Router from '@koa/router';
import Koa, { Middleware } from 'koa';
import { VERSION_TAG, VERSION_TAG_HEADER } from '@msdining/common/dist/constants/versions.js';
import { IServerSearchResult } from '../models/search.js';
import { ISearchResponseResult } from '@msdining/common/dist/models/http.js';
import { SearchEntityType, SearchMatchReason } from '@msdining/common/dist/models/search.js';
import { getStationLogoUrl } from './cafe.js';
import { jsonStringifyWithoutNull } from './serde.js';
import { getDevKey } from '../constants/env.js';

export const attachRouter = (parent: Koa | Router, child: Router) => parent.use(child.routes(), child.allowedMethods());

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

const serializeSearchResult = (searchResult: IServerSearchResult, allowModifiers: boolean): ISearchResponseResult => {
    const matchReasons = new Set(searchResult.matchReasons);
    if (!allowModifiers) {
        matchReasons.delete(SearchMatchReason.modifier);
    }

    return ({
        type:             searchResult.type,
        name:             searchResult.name,
        description:      searchResult.description || undefined,
        imageUrl:         getStationLogoUrl(searchResult.name, searchResult.imageUrl) || undefined,
        locations:        serializeMapOfStringToSet(searchResult.locationDatesByCafeId),
        prices:           Object.fromEntries(searchResult.priceByCafeId),
        stations:         Object.fromEntries(searchResult.stationByCafeId),
        tags:             searchResult.tags ? Array.from(searchResult.tags) : undefined,
        searchTags:       searchResult.searchTags ? Array.from(searchResult.searchTags) : undefined,
        matchedModifiers: allowModifiers ? serializeMapOfStringToSet(searchResult.matchedModifiers) : {},
        matchReasons:     Array.from(matchReasons),
        vectorDistance:   searchResult.vectorDistance,
    });
};

export const serializeSearchResults = (ctx: Koa.Context, searchResultsByIdPerEntityType: Map<SearchEntityType, Map<string, IServerSearchResult>>) => {
    const searchResults = [];
    const areModifiersAllowed = supportsVersionTag(ctx, VERSION_TAG.modifiersInSearchResults);

    for (const searchResultsById of searchResultsByIdPerEntityType.values()) {
        for (const searchResult of searchResultsById.values()) {
            searchResults.push(serializeSearchResult(searchResult, areModifiersAllowed));
        }
    }

    ctx.body = jsonStringifyWithoutNull(searchResults);
};

export const requireDevKey: Middleware = async (ctx, next) => {
    const key = getTrimmedQueryParam(ctx, 'key');
    if (key !== getDevKey()) {
        return ctx.throw(403, 'Invalid dev key');
    }

    await next();
}

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