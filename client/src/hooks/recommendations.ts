import { PromiseStage } from '@arcticzeroo/react-promise-hook';
import { useValueNotifier } from './events.ts';
import { IQuerySearchResult } from '../models/search.js';
import { ApplicationSettings } from '../constants/settings.js';
import { useFavoriteQueries } from './cafe.js';
import { useFavoriteSearchResults } from './favorites.js';

export interface IFavoritesSectionState {
    shouldShow: boolean;
    results: IQuerySearchResult[] | undefined;
    stage: PromiseStage;
    error: unknown;
    retry: () => void;
}

export const useFavoritesSection = (): IFavoritesSectionState => {
    const showFavorites = useValueNotifier(ApplicationSettings.showFavoritesOnHome);
    const favoriteQueries = useFavoriteQueries();

    const shouldShow = showFavorites && favoriteQueries.length > 0;

    const {
        stage,
        results,
        retry,
        error,
    } = useFavoriteSearchResults(
        favoriteQueries,
        shouldShow
    );

    return { shouldShow, results, stage, error, retry };
};