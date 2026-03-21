import Router from '@koa/router';
import {
	attachRouter,
	getEntityTypeAndName,
	getMaybeNumberQueryParam,
	getMaybeUserId,
	getTrimmedQueryParam,
	serializeSearchResults
} from '../../../util/koa.js';
import { SearchManager } from '../../../api/storage/search.js';
import { SearchEntityType } from '@msdining/common/models/search';
import { toDateString } from '@msdining/common/util/date-util';
import { IServerSearchResult } from '../../../models/search.js';
import { getSimilarQueries } from '../../../api/storage/vector/client.js';
import { assignCacheControlMiddleware, DEFAULT_CACHE_EXPIRATION_TIME } from '../../../middleware/cache.js';
import { getRecommendationsAsync } from '../../../api/cache/recommendations.js';
import { UserStorageClient } from '../../../api/storage/clients/user.js';
import { CAFES_BY_ID, GROUPS_BY_ID } from '../../../constants/cafes.js';
import { getDateForMenuRequest } from '../../../util/date.js';

export const registerRecommendationsRoutes = (parent: Router) => {
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

        const date = getDateForMenuRequest(ctx);
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
        await serializeSearchResults(ctx, trimResults(rawResults, limit));
    });

    router.get('/queries',
        assignCacheControlMiddleware(DEFAULT_CACHE_EXPIRATION_TIME, true /*isPublic*/),
        async ctx => {
            const query = getTrimmedQueryParam(ctx, 'q');

            if (!query) {
                ctx.throw(400, 'Missing query');
                return;
            }

            ctx.body = await getSimilarQueries(query);
        });

    const parseHomepageIds = (homepageIdsParam: string | undefined): string[] | undefined => {
        if (!homepageIdsParam) {
            return undefined;
        }

        const homepageIdsRaw = homepageIdsParam.split(',');
        const resolvedCafeIds: string[] = [];
        for (const homepageId of homepageIdsRaw) {
            const trimmedId = homepageId.trim();
            if (!trimmedId) {
                continue;
            }

            if (CAFES_BY_ID.has(trimmedId)) {
                resolvedCafeIds.push(trimmedId);
            } else {
                const group = GROUPS_BY_ID.get(trimmedId);
                if (group) {
                    for (const member of group.members) {
                        resolvedCafeIds.push(member.id);
                    }
                }
            }
        }

        if (resolvedCafeIds.length === 0) {
            return undefined;
        }

        return resolvedCafeIds;
    }

    const resolveHomepageIdsToIndividualCafeIds = (homepageIds: string[]): string[] => {
        const cafeIds: string[] = [];
        for (const homepageId of homepageIds) {
            if (CAFES_BY_ID.has(homepageId)) {
                cafeIds.push(homepageId);
            } else {
                const group = GROUPS_BY_ID.get(homepageId);
                if (group) {
                    for (const member of group.members) {
                        cafeIds.push(member.id);
                    }
                }
            }
        }
        return cafeIds;
    };

    const resolveHomepageIds = (homepageIds: string[] | undefined, userSettings: { homepageIds?: string[] } | undefined): string[] => {
        if (homepageIds) {
            return homepageIds;
        }
        return resolveHomepageIdsToIndividualCafeIds(userSettings?.homepageIds ?? []);
    };

    const resolveFavoriteItemNames = (favoriteItemNamesParam: string | undefined, userSettings: { favoriteMenuItems?: string[] } | undefined): string[] => {
        if (favoriteItemNamesParam) {
            return favoriteItemNamesParam.split(';').map(name => name.trim()).filter(Boolean);
        }
        return userSettings?.favoriteMenuItems ?? [];
    };

    router.get('/for-you', async ctx => {
        const date = getDateForMenuRequest(ctx);

        if (!date) {
            ctx.throw(400, 'Missing or invalid date');
            return;
        }

        const dateString = toDateString(date);
        const cafeId = getTrimmedQueryParam(ctx, 'cafeId');
        const homepageIdsParam = getTrimmedQueryParam(ctx, 'homepageIds');
        const homepageIds = parseHomepageIds(homepageIdsParam);
        const favoriteItemNamesParam = getTrimmedQueryParam(ctx, 'favoriteItemNames');
        const userId = getMaybeUserId(ctx);

        const userSettings = userId
            ? (await UserStorageClient.getUserAsync({ id: userId }))?.settings
            : undefined;

        const resolvedHomepageIds = resolveHomepageIds(homepageIds, userSettings);
        const favoriteItemNames = resolveFavoriteItemNames(favoriteItemNamesParam, userSettings);

        ctx.body = await getRecommendationsAsync(userId, dateString, resolvedHomepageIds, favoriteItemNames, cafeId);
    });

    attachRouter(parent, router);
};
