import type { ISearchQueryService } from '../../../shared/services/search-query.js';
import { dataHandler } from './handler.js';

/**
 * Main-side typed client for {@link ISearchQueryService}. Both this object
 * and the worker-side `searchQueryServiceCommands` are typed against the
 * same interface, so adding a method to the interface is a compile error
 * until both sides implement it.
 */
export const searchQueryService: ISearchQueryService = {
    incrementSearchCount: (data) =>
        dataHandler.sendRequest('searchQuery', 'incrementSearchCount', data),
    getTopSearchQueries: (data) =>
        dataHandler.sendRequest('searchQuery', 'getTopSearchQueries', data),
};
