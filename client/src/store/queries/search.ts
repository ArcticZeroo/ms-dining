import { ISearchQuery, SearchEntityType } from '@msdining/common/models/search';
import { toDateString } from '@msdining/common/util/date-util';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { DiningClient } from '../../api/client/dining.ts';
import { queryKeys } from './keys.ts';

// ---------- Pure helpers (exported for testing) ----------

/**
 * Stable hash for a single search query. Used in TanStack query keys so two
 * equivalent query arrays dedupe to the same key.
 */
export const searchQueryHash = (query: ISearchQuery): string => {
    const typeValue = query.type ?? SearchEntityType.menuItem;
    return `${typeValue}:${query.text}`;
};

export const searchQueryHashes = (queries: ISearchQuery[]): string[] =>
    queries.map(searchQueryHash).sort();

// ---------- Queries ----------

export const useCheapItemsQuery = (date: Date | undefined) => {
    const dateString = date ? toDateString(date) : '';
    return useQuery({
        queryKey: queryKeys.search.cheapItems(dateString),
        queryFn:  () => DiningClient.retrieveCheapItems(date),
    });
};

/**
 * Server-side autocomplete suggestions (cafes excluded; the autocomplete UI
 * mixes server suggestions with locally-derived cafe suggestions). Disabled
 * when the query is empty.
 */
export const useAutocompleteSuggestionsQuery = (query: string) =>
    useQuery({
        queryKey: queryKeys.search.autocomplete(query),
        queryFn:  async () => {
            const results = await DiningClient.retrieveAutocompleteSuggestions(query);
            return results.filter(result => result.entityType !== SearchEntityType.cafe);
        },
        enabled: query.length > 0,
    });

export const useRecommendedQueriesQuery = (query: string) =>
    useQuery({
        queryKey: queryKeys.search.recommendedQueries(query),
        queryFn:  () => DiningClient.retrieveRecommendedQueries(query),
    });

export const useFavoriteSearchResultsQuery = (
    queries: ISearchQuery[],
    dateForSearch: Date | undefined,
    isEnabled: boolean = true,
) => {
    const queryHashes = useMemo(() => searchQueryHashes(queries), [queries]);
    const dateString = dateForSearch ? toDateString(dateForSearch) : '';

    return useQuery({
        queryKey:    queryKeys.search.favorites(dateString, queryHashes),
        queryFn:     () => DiningClient.retrieveFavoriteSearchResults(queries, dateForSearch),
        enabled:     isEnabled && queries.length > 0,
        placeholderData: (previous) => previous,
    });
};

export const useRecommendationsQuery = (date: Date) => {
    const dateString = toDateString(date);
    return useQuery({
        queryKey:        queryKeys.search.recommendations(dateString),
        queryFn:         () => DiningClient.retrieveRecommendations(dateString),
        placeholderData: (previous) => previous,
    });
};

export const useSearchResultsQuery = (query: string, dateForSearch: Date | undefined) => {
    const dateString = dateForSearch ? toDateString(dateForSearch) : '';
    return useQuery({
        queryKey:        queryKeys.search.results(dateString, query),
        queryFn:         () => DiningClient.retrieveSearchResults({ query, date: dateForSearch }),
        enabled:         query.length > 0,
        placeholderData: (previous) => previous,
    });
};
