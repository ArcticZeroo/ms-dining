import type { ISearchService } from '../../../shared/services/search.js';
import { dataHandler } from './handler.js';

export const searchService: ISearchService = {
    search: (data) =>
        dataHandler.sendRequest('search', 'search', data),
    searchVector: (data) =>
        dataHandler.sendRequest('search', 'searchVector', data),
    searchForSimilarEntities: (data) =>
        dataHandler.sendRequest('search', 'searchForSimilarEntities', data),
    searchFavorites: (data) =>
        dataHandler.sendRequest('search', 'searchFavorites', data),
    searchForCheapItems: (data) =>
        dataHandler.sendRequest('search', 'searchForCheapItems', data),
    autocomplete: (data) =>
        dataHandler.sendRequest('search', 'autocomplete', data),
    getSimilarQueries: (data) =>
        dataHandler.sendRequest('search', 'getSimilarQueries', data),
    getRecommendations: (data) =>
        dataHandler.sendRequest('search', 'getRecommendations', data),
};
