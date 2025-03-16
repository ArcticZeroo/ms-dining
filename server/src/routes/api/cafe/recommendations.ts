import Router from '@koa/router';
import { RouteBuilder } from '../../../models/koa.js';
import {
	attachRouter, getEntityTypeAndName,
	getMaybeNumberQueryParam,
	getTrimmedQueryParam,
	serializeSearchResults
} from '../../../util/koa.js';
import { SearchManager } from '../../../api/storage/search.js';
import { SearchEntityType } from '@msdining/common/dist/models/search.js';
import { fromMaybeDateString } from '@msdining/common/dist/util/date-util.js';
import { IServerSearchResult } from '../../../models/search.js';
import { getSimilarQueries } from '../../../api/storage/vector/client.js';

export const registerRecommendationsRoutes: RouteBuilder = (parent) => {
	const router = new Router({
		prefix: '/recommendations'
	});

	const trimResults = (results: Map<SearchEntityType, Map<string, IServerSearchResult>>, limit: number) => {
		const allResults: Array<{ entityType: SearchEntityType, name: string, result: IServerSearchResult }> = [];
		for (const [entityType, entityResults] of results) {
			for (const [name, result] of entityResults) {
				allResults.push({ entityType, name, result });
			}
		}

		allResults.sort(({ result: a }, { result: b }) => {
			if (a.vectorDistance == null || b.vectorDistance == null) {
				throw new Error('Missing vector distance');
			}

			return a.vectorDistance - b.vectorDistance;
		});

		const trimmedResultsList = allResults.slice(0, limit);

		const trimmedResults = new Map<SearchEntityType, Map<string, IServerSearchResult>>();
		for (const { entityType, name, result } of trimmedResultsList) {
			const results = trimmedResults.get(entityType) ?? new Map<string, IServerSearchResult>();
			results.set(name, result);
			trimmedResults.set(entityType, results);
		}

		return trimmedResults;
	}

	router.get('/similar', async ctx => {
		const [entityType, entityName] = getEntityTypeAndName(ctx);

		const date = fromMaybeDateString(getTrimmedQueryParam(ctx, 'date'));
		const limit = getMaybeNumberQueryParam(ctx, 'limit');

		if (!date) {
			ctx.throw(400, 'Invalid date');
			return;
		}

		if (!limit || limit < 1 || limit > 10) {
			ctx.throw(400, 'Invalid limit, must be between 1 and 10');
			return;
		}

		const rawResults = await SearchManager.searchForSimilarEntities({ entityName, entityType, date });
		serializeSearchResults(ctx, trimResults(rawResults, limit));
	});

	router.get('/queries', async ctx => {
		const query = getTrimmedQueryParam(ctx, 'q');

		if (!query) {
			ctx.throw(400, 'Missing query');
			return;
		}

		ctx.body = await getSimilarQueries(query);
	});

	attachRouter(parent, router);
};
