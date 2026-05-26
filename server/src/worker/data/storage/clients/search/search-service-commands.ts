import type { ISearchQuery, SearchEntityType } from '@msdining/common/models/search';
import type { ISearchService } from '../../../../../shared/services/search.js';
import type { ICheapItemSearchResult, IServerSearchResult } from '../../../../../shared/models/search.js';
import { SearchManager } from '../../search.js';
import { searchAutocomplete } from '../../../cache/autocomplete.js';
import { getSimilarQueries as getSimilarQueriesAsync } from '../../vector/client.js';
import { getRecommendationsAsync } from '../../../cache/recommendations.js';
import { ServiceError, SERVICE_ERROR_CODES } from '../../../../rpc/errors.js';

const parseDate = (dateString: string | null): Date | null =>
    dateString ? new Date(dateString) : null;

const materializeImageUrl = async (
    imageUrl: IServerSearchResult['imageUrl'] | ICheapItemSearchResult['imageUrl'],
): Promise<string | null | undefined> =>
    typeof imageUrl === 'function'
        ? await imageUrl()
        : imageUrl;

const materializeSearchResults = async (
    searchResultsByEntityType: Map<SearchEntityType, Map<string, IServerSearchResult>>,
): Promise<Map<SearchEntityType, Map<string, IServerSearchResult>>> => {
    const materializedResults = new Map<SearchEntityType, Map<string, IServerSearchResult>>();

    for (const [entityType, resultsById] of searchResultsByEntityType) {
        const materializedResultsById = new Map<string, IServerSearchResult>();
        for (const [id, result] of resultsById) {
            materializedResultsById.set(id, {
                ...result,
                imageUrl: await materializeImageUrl(result.imageUrl),
            });
        }
        materializedResults.set(entityType, materializedResultsById);
    }

    return materializedResults;
};

const materializeCheapItemResults = async (
    cheapItems: ICheapItemSearchResult[],
): Promise<ICheapItemSearchResult[]> => Promise.all(
    cheapItems.map(async item => ({
        ...item,
        imageUrl: await materializeImageUrl(item.imageUrl),
    })),
);

export const searchServiceCommands = {
    search: async ({ query, date, shouldUseExactMatch }: { query: string; date: string | null; shouldUseExactMatch?: boolean }) =>
        materializeSearchResults(await SearchManager.search(query, parseDate(date), shouldUseExactMatch)),
    searchVector: async ({ query, date, allowResultsWithoutAppearances }: { query: string; date: string | null; allowResultsWithoutAppearances: boolean }) =>
        materializeSearchResults(await SearchManager.searchVector(query, parseDate(date), allowResultsWithoutAppearances)),
    searchForSimilarEntities: async ({ entityName, entityType, date }: { entityName: string; entityType: SearchEntityType; date: string | null }) => {
        if (date == null) {
            throw new ServiceError(SERVICE_ERROR_CODES.BAD_REQUEST, 'date is required');
        }

        return materializeSearchResults(await SearchManager.searchForSimilarEntities({
            entityName,
            entityType,
            date: new Date(date),
        }));
    },
    searchFavorites: async ({ queries, date }: { queries: ISearchQuery[]; date: string | null }) =>
        materializeSearchResults(await SearchManager.searchFavorites(queries, parseDate(date))),
    searchForCheapItems: async ({ minPrice, maxPrice, date }: { minPrice: number; maxPrice: number; date: string | null }) =>
        materializeCheapItemResults(await SearchManager.searchForCheapItems({ minPrice, maxPrice, date: parseDate(date) })),
    autocomplete: async ({ query }: { query: string }) =>
        searchAutocomplete(query),
    getSimilarQueries: async ({ query }: { query: string }) =>
        getSimilarQueriesAsync(query),
    getRecommendations: async ({ userId, dateString, homepageIds, favoriteItemNames, cafeIdFilter }: {
        userId?: string;
        dateString: string;
        homepageIds?: string[];
        favoriteItemNames?: string[];
        cafeIdFilter?: string[];
    }) => getRecommendationsAsync({
        userId: userId ?? null,
        dateString,
        homepageIds: homepageIds ?? [],
        favoriteItemNames: favoriteItemNames ?? [],
        cafeIdFilter: cafeIdFilter ? new Set(cafeIdFilter) : undefined,
    }),
} satisfies ISearchService;
