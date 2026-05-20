import type { ISearchQueryService } from '../../../shared/services/search-query.js';
import { dataHandler } from './handler.js';

/**
 * Main-side typed client for {@link ISearchQueryService}. Implements the
 * interface by forwarding every method through the data handler — phase 1
 * stays in-process, phase 2 transparently crosses the worker boundary
 * (this file does not change between phases).
 *
 * Imported into the `Services` bag at `data.searchQuery` and consumed via
 * `getServices().data.searchQuery.x(...)` from main-thread call sites.
 */
export const searchQueryService: ISearchQueryService = {
    incrementSearchCount: (query) =>
        dataHandler.sendRequest('searchQuery', 'incrementSearchCount', { query }),
    getTopSearchQueries: (limit) =>
        dataHandler.sendRequest('searchQuery', 'getTopSearchQueries', { limit }),
};
