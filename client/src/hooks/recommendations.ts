import { useValueNotifier } from './events.ts';
import { IQuerySearchResult } from '../models/search.js';
import { ApplicationSettings } from '../constants/settings.js';
import { useFavoriteQueries } from './cafe.js';
import { useFavoriteSearchResults } from './favorites.js';

export interface IFavoritesSectionState {
    shouldShow: boolean;
    isPending: boolean;
    isError: boolean;
    results: IQuerySearchResult[] | undefined;
    retry: () => void;
}

export const useFavoritesSection = (): IFavoritesSectionState => {
    const showFavorites = useValueNotifier(ApplicationSettings.showFavoritesOnHome);
    const favoriteQueries = useFavoriteQueries();

    const shouldShow = showFavorites && favoriteQueries.length > 0;

    const { isPending, isError, results, retry } = useFavoriteSearchResults(
        favoriteQueries,
        shouldShow
    );

    return { shouldShow, isPending, isError, results, retry };
};