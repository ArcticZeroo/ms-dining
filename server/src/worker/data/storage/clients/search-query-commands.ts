import type { ISearchQueryService } from '../../../../shared/services/search-query.js';
import { SearchQueryClient } from './search-query.js';

export const searchQueryServiceCommands = {
    incrementSearchCount: async ({ query }: { query: string }) =>
        SearchQueryClient.incrementSearchCount(query),
    getTopSearchQueries: async ({ limit }: { limit?: number }) =>
        SearchQueryClient.getTopSearchQueries(limit),
} satisfies ISearchQueryService;
