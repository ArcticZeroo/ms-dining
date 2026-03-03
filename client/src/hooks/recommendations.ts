import { useCallback, useEffect, useMemo } from 'react';
import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { ISearchQuery } from '@msdining/common/models/search';
import { DiningClient } from '../api/client/dining.ts';
import { SelectedDateContext } from '../context/time.ts';
import { useDateForSearch } from './date-picker.tsx';
import { useValueNotifier, useValueNotifierContext } from './events.ts';
import { isAnyDateToday } from '../util/search.ts';
import { IQuerySearchResult } from '../models/search.js';
import { ApplicationSettings } from '../constants/settings.js';
import { useFavoriteQueries } from './cafe.js';

export const useFavoriteResults = (queries: ISearchQuery[], shouldShow: boolean) => {
    const selectedDate = useValueNotifierContext(SelectedDateContext);
    const dateForSearch = useDateForSearch();

    const fetchFavorites = useCallback(async () => {
        if (queries.length === 0 || !shouldShow) {
            return [];
        }

        return DiningClient.retrieveFavoriteSearchResults(queries, dateForSearch);
    }, [queries, dateForSearch, shouldShow]);

    const { stage, value, error, run } = useDelayedPromiseState(fetchFavorites);

    useEffect(() => {
        run();
    }, [run]);

    const filteredResults = useMemo(
        () => value?.filter(item => isAnyDateToday(item.locationDatesByCafeId, selectedDate)),
        [value, selectedDate]
    );

    return { stage, results: filteredResults, error, retry: run };
};

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
    } = useFavoriteResults(
        favoriteQueries,
        shouldShow
    );

    return { shouldShow, results, stage, error, retry };
};