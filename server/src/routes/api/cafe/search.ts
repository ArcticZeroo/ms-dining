import { isDuckTypeArray } from '@arcticzeroo/typeguard';
import Router from '@koa/router';
import { ISearchQuery, SearchEntityType } from '@msdining/common/dist/models/search.js';
import { SearchManager } from '../../../api/storage/search.js';
import { requireMenusNotUpdating } from '../../../middleware/menu.js';
import { ISearchResult } from '../../../models/search.js';
import { getBetterLogoUrl } from '../../../util/cafe.js';
import { attachRouter, getTrimmedQueryParam } from '../../../util/koa.js';
import { jsonStringifyWithoutNull } from '../../../util/serde.js';
import { NumberUtil } from '@msdining/common';

const DEFAULT_MAX_PRICE = 15;
const DEFAULT_MIN_PRICE = 1;

export const registerSearchRoutes = (parent: Router) => {
    const router = new Router({
        prefix: '/search'
    });

    const serializeLocationDatesByCafeId = (locationDatesByCafeId: Map<string, Set<string>>) => {
        const serialized: Record<string /*cafeId*/, Array<string>> = {};
        for (const [cafeId, dates] of locationDatesByCafeId.entries()) {
            serialized[cafeId] = Array.from(dates);
        }
        return serialized;
    }

    const serializeSearchResult = (searchResult: ISearchResult) => ({
        type:         searchResult.type,
        name:         searchResult.name,
        description:  searchResult.description,
        imageUrl:     getBetterLogoUrl(searchResult.name, searchResult.imageUrl),
        locations:    serializeLocationDatesByCafeId(searchResult.locationDatesByCafeId),
        matchReasons: Array.from(searchResult.matchReasons),
        prices:       Array.from(searchResult.prices),
    });

    const serializeSearchResults = (searchResultsByIdPerEntityType: Map<SearchEntityType, Map<string, ISearchResult>>) => {
        const searchResults = [];
        for (const searchResultsById of searchResultsByIdPerEntityType.values()) {
            for (const searchResult of searchResultsById.values()) {
                searchResults.push(serializeSearchResult(searchResult));
            }
        }
        return jsonStringifyWithoutNull(searchResults);
    }

    router.post('/favorites', requireMenusNotUpdating, async ctx => {
        const queries = ctx.request.body;

        if (!isDuckTypeArray<ISearchQuery>(queries, { text: 'string', type: 'string' })) {
            ctx.throw(400, 'Invalid request body');
            return;
        }

        const searchResultsByIdPerEntityType = await SearchManager.searchFavorites(queries);
        ctx.body = serializeSearchResults(searchResultsByIdPerEntityType);
    });

    router.get('/search', requireMenusNotUpdating, async ctx => {
        const searchQuery = getTrimmedQueryParam(ctx, 'q');

        if (!searchQuery) {
            ctx.body = [];
            return;
        }

        const searchResultsByIdPerEntityType = await SearchManager.search(searchQuery);
        ctx.body = serializeSearchResults(searchResultsByIdPerEntityType);
    });

    router.get('/cheap', requireMenusNotUpdating, async ctx => {
        const maxPriceRaw = ctx.query.max;
        const minPriceRaw = ctx.query.min;

        const maxPrice = typeof maxPriceRaw === 'string'
                         ? NumberUtil.parseNumber(maxPriceRaw, DEFAULT_MAX_PRICE)
                         : DEFAULT_MAX_PRICE;

        const minPrice = typeof minPriceRaw === 'string'
                         ? NumberUtil.parseNumber(minPriceRaw, DEFAULT_MIN_PRICE)
                         : DEFAULT_MIN_PRICE;

        const cheapItems = await SearchManager.searchForCheapItems(
            minPrice,
            maxPrice
        );

        const searchResults = [];
        for (const searchResult of cheapItems) {
            searchResults.push({
                name:        searchResult.name,
                description: searchResult.description,
                imageUrl:    searchResult.imageUrl,
                locations:   serializeLocationDatesByCafeId(searchResult.locationDatesByCafeId),
                price:       searchResult.price,
                minCalories: searchResult.minCalories,
                maxCalories: searchResult.maxCalories,
            });
        }

        ctx.body = jsonStringifyWithoutNull(searchResults);
    });

    attachRouter(parent, router);
};
