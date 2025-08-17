import { isDuckTypeArray } from '@arcticzeroo/typeguard';
import Router from '@koa/router';
import { DateUtil, NumberUtil } from '@msdining/common';
import { ANALYTICS_APPLICATION_NAMES } from '@msdining/common/dist/constants/analytics.js';
import { VERSION_TAG } from '@msdining/common/dist/constants/versions.js';
import { ISearchQuery } from '@msdining/common/dist/models/search.js';
import { SearchManager } from '../../../api/storage/search.js';
import { sendVisitFromQueryParamMiddleware, sendVisitMiddleware } from '../../../middleware/analytics.js';
import { memoizeResponseBodyByQueryParams } from '../../../middleware/cache.js';
import {
    attachRouter,
    getEntityTypeAndName,
    getTrimmedQueryParam,
    serializeMapOfStringToSet,
    serializeSearchResults,
    supportsVersionTag
} from '../../../util/koa.js';
import { jsonStringifyWithoutNull } from '../../../util/serde.js';
import { logDebug, logError } from '../../../util/log.js';
import { EMBEDDINGS_WORKER_QUEUE } from '../../../worker/queues/embeddings.js';
import { retrieveVisitData } from '../../../api/cache/pattern.js';
import { Middleware } from 'koa';
import { SearchQueryClient } from '../../../api/storage/clients/search-query.js';

const DEFAULT_MAX_PRICE = 15;
const DEFAULT_MIN_PRICE = 1;

export const registerSearchRoutes = (parent: Router) => {
    const router = new Router({
        prefix: '/search'
    });

    router.post('/favorites',
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

    const getApplicationNameForSearch = (isExplore: string | undefined) => {
        return isExplore === 'true'
               ? ANALYTICS_APPLICATION_NAMES.searchExplore
               : ANALYTICS_APPLICATION_NAMES.search;
    };

    const incrementSearchCountMiddleware: Middleware = (ctx, next) => {
        const searchQuery = getTrimmedQueryParam(ctx, 'q');
        if (searchQuery) {
            SearchQueryClient.incrementSearchCount(searchQuery)
                .catch(err => logError('Could not increment search count:', err));
        }
        return next();
    }

    router.get('/',
        sendVisitFromQueryParamMiddleware('exp', getApplicationNameForSearch),
        incrementSearchCountMiddleware,
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
                // If a date is specified, we clearly only want appearances from that date.
                // Otherwise, we only want appearances from this week if the client supports it (since otherwise it shows weird hidden UI)
                // and the client hasn't told us to filter out results without appearances (e.g. search ideas)
                const allowResultsWithoutAppearances = date == null && supportsVersionTag(ctx, VERSION_TAG.searchResultsNotHereThisWeek) && getTrimmedQueryParam(ctx, 'availableOnly') !== 'true';
                const results = await SearchManager.searchVector(searchQuery, date, allowResultsWithoutAppearances);
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

    router.get('/visit-history',
        sendVisitMiddleware(ANALYTICS_APPLICATION_NAMES.pattern),
        memoizeResponseBodyByQueryParams(),
        async ctx => {
            const [entityType, entityName] = getEntityTypeAndName(ctx);
            ctx.body = await retrieveVisitData(entityType, entityName);
        });

    attachRouter(parent, router);
};
