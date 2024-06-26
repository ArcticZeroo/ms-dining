import { isDuckTypeArray } from '@arcticzeroo/typeguard';
import Router from '@koa/router';
import { ISearchResponseResult } from '@msdining/common/dist/models/http.js';
import { ISearchQuery, SearchEntityType } from '@msdining/common/dist/models/search.js';
import { SearchManager } from '../../../api/storage/search.js';
import { IServerSearchResult } from '../../../models/search.js';
import { getBetterLogoUrl } from '../../../util/cafe.js';
import { attachRouter, getTrimmedQueryParam } from '../../../util/koa.js';
import { jsonStringifyWithoutNull } from '../../../util/serde.js';
import { DateUtil, NumberUtil } from '@msdining/common';
import { memoizeResponseBodyByQueryParams } from '../../../middleware/cache.js';
import { requireNoMenusUpdating } from '../../../middleware/menu.js';
import { ANALYTICS_APPLICATION_NAMES } from '@msdining/common/dist/constants/analytics.js';
import { sendVisit, sendVisitFromQueryParamMiddleware, sendVisitMiddleware } from '../../../middleware/analytics.js';

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
	};

	const serializeSearchResult = (searchResult: IServerSearchResult): ISearchResponseResult => ({
		type:         searchResult.type,
		name:         searchResult.name,
		description:  searchResult.description || undefined,
		imageUrl:     getBetterLogoUrl(searchResult.name, searchResult.imageUrl) || undefined,
		locations:    serializeLocationDatesByCafeId(searchResult.locationDatesByCafeId),
		prices:       Object.fromEntries(searchResult.priceByCafeId),
		stations:     Object.fromEntries(searchResult.stationByCafeId),
		matchReasons: Array.from(searchResult.matchReasons),
		tags:         searchResult.tags ? Array.from(searchResult.tags) : undefined,
		searchTags:   searchResult.searchTags ? Array.from(searchResult.searchTags) : undefined
	});

	const serializeSearchResults = (searchResultsByIdPerEntityType: Map<SearchEntityType, Map<string, IServerSearchResult>>) => {
		const searchResults = [];
		for (const searchResultsById of searchResultsByIdPerEntityType.values()) {
			for (const searchResult of searchResultsById.values()) {
				searchResults.push(serializeSearchResult(searchResult));
			}
		}
		return jsonStringifyWithoutNull(searchResults);
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
			ctx.body = serializeSearchResults(searchResultsByIdPerEntityType);
		});

	const getApplicationNameForSearch = (isExplore: string) => {
		return isExplore === 'true'
			? ANALYTICS_APPLICATION_NAMES.searchExplore
			: ANALYTICS_APPLICATION_NAMES.search
	};

	router.get('/',
		requireNoMenusUpdating,
		sendVisitFromQueryParamMiddleware('exp', getApplicationNameForSearch),
		memoizeResponseBodyByQueryParams(),
		async ctx => {
			const searchQuery = getTrimmedQueryParam(ctx, 'q');
			const isExact = getTrimmedQueryParam(ctx, 'e') === 'true';

			if (!searchQuery) {
				ctx.body = [];
				return;
			}

			const date = DateUtil.fromMaybeDateString(ctx.query.date);

			const searchResultsByIdPerEntityType = await SearchManager.search(
				searchQuery,
				date,
				isExact
			);

			ctx.body = serializeSearchResults(searchResultsByIdPerEntityType);
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
