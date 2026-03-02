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
import { getFridayForWeek, getMondayForWeek, isDateInRangeInclusive } from '@msdining/common/util/date-util';

export const useFavoriteResults = (queries: ISearchQuery[], shouldShow: boolean) => {
    const selectedDate = useValueNotifierContext(SelectedDateContext);
    const dateForSearch = useDateForSearch();

    const fetchFavorites = useCallback(async () => {
        if (queries.length === 0 || !shouldShow) {
            return [];
        }

        return DiningClient.retrieveFavoriteSearchResults(queries, dateForSearch);
    }, [queries, dateForSearch, shouldShow]);

    const { stage, value, actualStage, error, run } = useDelayedPromiseState(
        fetchFavorites,
        true /*keepLastValue*/
    );

    useEffect(() => {
        run();
    }, [run]);

    const filteredResults = useMemo(
        () => value?.filter(item => isAnyDateToday(item.locationDatesByCafeId, selectedDate)),
        [value, selectedDate]
    );

    return { stage, results: filteredResults, actualStage, error, retry: run };
};

export interface IFavoritesSectionState {
    shouldShow: boolean;
    results: IQuerySearchResult[] | undefined;
    stage: PromiseStage;
    actualStage: PromiseStage;
    error: unknown;
    retry: () => void;
}

export const useFavoritesSection = (): IFavoritesSectionState => {
    const selectedDate = useValueNotifierContext(SelectedDateContext);

    const showFavorites = useValueNotifier(ApplicationSettings.showFavoritesOnHome);
    const favoriteQueries = useFavoriteQueries();

    const areFavoritesAllowedForSelectedDay = useMemo(() => {
        const now = new Date();
        const monday = getMondayForWeek(now);
        const friday = getFridayForWeek(now);
        return isDateInRangeInclusive(selectedDate, [monday, friday]);
    }, [selectedDate]);

    const shouldShow = showFavorites && favoriteQueries.length > 0 && areFavoritesAllowedForSelectedDay;

    const {
        stage,
        results,
        retry,
        actualStage,
        error,
    } = useFavoriteResults(
        favoriteQueries,
        shouldShow
    );

    return { shouldShow, results, stage, actualStage, error, retry };
};