import { isDuckTypeArray } from '@arcticzeroo/typeguard';
import Router from '@koa/router';
import { DateUtil, NumberUtil } from '@msdining/common';
import { ANALYTICS_APPLICATION_NAMES } from '@msdining/common/dist/constants/analytics.js';
import { VERSION_TAG } from '@msdining/common/dist/constants/versions.js';
import { ISearchResponseResult } from '@msdining/common/dist/models/http.js';
import { ISearchQuery, SearchEntityType, SearchMatchReason } from '@msdining/common/dist/models/search.js';
import Koa from 'koa';
import { SearchManager } from '../../../api/storage/search.js';
import { sendVisitFromQueryParamMiddleware, sendVisitMiddleware } from '../../../middleware/analytics.js';
import { memoizeResponseBodyByQueryParams } from '../../../middleware/cache.js';
import { requireNoMenusUpdating } from '../../../middleware/menu.js';
import { IServerSearchResult } from '../../../models/search.js';
import { getBetterLogoUrl } from '../../../util/cafe.js';
import { attachRouter, getTrimmedQueryParam, supportsVersionTag } from '../../../util/koa.js';
import { jsonStringifyWithoutNull } from '../../../util/serde.js';
import { logDebug } from '../../../util/log.js';
import { EMBEDDINGS_WORKER_QUEUE } from '../../../worker/embeddings.js';

const DEFAULT_MAX_PRICE = 15;
const DEFAULT_MIN_PRICE = 1;

export const registerSearchRoutes = (parent: Router) => {
    const router = new Router({
        prefix: '/search'
    });

    const serializeMapOfStringToSet = (deserialized: Map<string, Set<string>>) => {
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
            imageUrl:         getBetterLogoUrl(searchResult.name, searchResult.imageUrl) || undefined,
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

    const serializeSearchResults = (ctx: Koa.Context, searchResultsByIdPerEntityType: Map<SearchEntityType, Map<string, IServerSearchResult>>) => {
        const searchResults = [];
        const areModifiersAllowed = supportsVersionTag(ctx, VERSION_TAG.modifiersInSearchResults);

        for (const searchResultsById of searchResultsByIdPerEntityType.values()) {
            for (const searchResult of searchResultsById.values()) {
                searchResults.push(serializeSearchResult(searchResult, areModifiersAllowed));
            }
        }

        ctx.body = jsonStringifyWithoutNull(searchResults);
    };

    router.post('/favorites',
        requireNoMenusUpdating,
        sendVisitMiddleware(ANALYTICS_APPLICATION_NAMES.searchFavorites),
        async ctx => {
            const queries = ctx.request.body;

            if (!isDuckTypeArray<ISearchQuery>(queries, { text: 'string', type: 'string' })) {
                ctx.throw(400, 'Invalid request body');
                return;
            }

            const date = DateUtil.fromMaybeDateString(ctx.query.date);
            const searchResultsByIdPerEntityType = await SearchManager.searchFavorites(queries, date);
            serializeSearchResults(ctx, searchResultsByIdPerEntityType);
        });

    const getApplicationNameForSearch = (isExplore: string) => {
        return isExplore === 'true'
               ? ANALYTICS_APPLICATION_NAMES.searchExplore
               : ANALYTICS_APPLICATION_NAMES.search;
    };

    router.get('/',
        requireNoMenusUpdating,
        sendVisitFromQueryParamMiddleware('exp', getApplicationNameForSearch),
        memoizeResponseBodyByQueryParams(),
        async ctx => {
            const searchQuery = getTrimmedQueryParam(ctx, 'q');
            const isExact = getTrimmedQueryParam(ctx, 'e') === 'true';
            const isVectorSearchAllowed = getTrimmedQueryParam(ctx, 'nv') !== 'true';

            if (!searchQuery) {
                ctx.body = [];
                return;
            }

            const date = DateUtil.fromMaybeDateString(ctx.query.date);

            // Temporary while we prove out vector search. Eventually we should be able to get exact queries.
            if (isVectorSearchAllowed && !isExact) {
                const startTime = Date.now();
                const results = await SearchManager.searchVector(searchQuery, date);
                serializeSearchResults(ctx, results);
                const endTime = Date.now();
                logDebug(`Search for ${searchQuery} took ${endTime - startTime}ms`);
                ctx.set('X-Remaining-Embeddings', String(EMBEDDINGS_WORKER_QUEUE.remainingItems));
            } else {
                const results = await SearchManager.search(
                    searchQuery,
                    date,
                    isExact
                );

                serializeSearchResults(ctx, results);
            }

        });

    router.get('/cheap',
        requireNoMenusUpdating,
        sendVisitMiddleware(ANALYTICS_APPLICATION_NAMES.cheapItems),
        memoizeResponseBodyByQueryParams(),
        async ctx => {
            const maxPriceRaw = ctx.query.max;
            const minPriceRaw = ctx.query.min;

            const maxPrice = typeof maxPriceRaw === 'string'
                             ? NumberUtil.parseNumber(maxPriceRaw, DEFAULT_MAX_PRICE)
                             : DEFAULT_MAX_PRICE;

            const minPrice = typeof minPriceRaw === 'string'
                             ? NumberUtil.parseNumber(minPriceRaw, DEFAULT_MIN_PRICE)
                             : DEFAULT_MIN_PRICE;

            const date = DateUtil.fromMaybeDateString(ctx.query.date);

            const cheapItems = await SearchManager.searchForCheapItems({
                minPrice,
                maxPrice,
                date
            });

            const searchResults = [];
            for (const searchResult of cheapItems) {
                searchResults.push({
                    name:        searchResult.name,
                    description: searchResult.description,
                    imageUrl:    searchResult.imageUrl,
                    locations:   serializeMapOfStringToSet(searchResult.locationDatesByCafeId),
                    price:       searchResult.price,
                    minCalories: searchResult.minCalories,
                    maxCalories: searchResult.maxCalories,
                });
            }

            ctx.body = jsonStringifyWithoutNull(searchResults);
        });

    attachRouter(parent, router);
};
