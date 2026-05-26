import type {
    IAutocompleteSuggestion,
    ISearchQuery,
    SearchEntityType,
} from '@msdining/common/models/search';
import type { IRecommendationSection } from '@msdining/common/models/recommendation';
import type { ICheapItemSearchResult, IServerSearchResult } from '../models/search.js';

export interface ISearchService {
    search(data: { query: string; date: string | null; shouldUseExactMatch?: boolean }): Promise<Map<SearchEntityType, Map<string, IServerSearchResult>>>;
    searchVector(data: { query: string; date: string | null; allowResultsWithoutAppearances: boolean }): Promise<Map<SearchEntityType, Map<string, IServerSearchResult>>>;
    searchForSimilarEntities(data: { entityName: string; entityType: SearchEntityType; date: string | null }): Promise<Map<SearchEntityType, Map<string, IServerSearchResult>>>;
    searchFavorites(data: { queries: ISearchQuery[]; date: string | null }): Promise<Map<SearchEntityType, Map<string, IServerSearchResult>>>;
    searchForCheapItems(data: { minPrice: number; maxPrice: number; date: string | null }): Promise<ICheapItemSearchResult[]>;
    autocomplete(data: { query: string }): Promise<IAutocompleteSuggestion[]>;
    getSimilarQueries(data: { query: string }): Promise<string[]>;
    getRecommendations(data: {
        userId?: string;
        dateString: string;
        homepageIds?: string[];
        favoriteItemNames?: string[];
        cafeIdFilter?: string[];
    }): Promise<IRecommendationSection[]>;
}
