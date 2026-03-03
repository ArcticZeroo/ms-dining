import { ISearchQuery } from '@msdining/common/models/search';
import { useValueNotifierContext } from './events.js';
import { SelectedDateContext } from '../context/time.js';
import { useDateForSearch } from './date-picker.js';
import { useCallback, useEffect, useMemo } from 'react';
import { DiningClient } from '../api/client/dining.js';
import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { isAnyDateToday } from '../util/search.js';
import { IQuerySearchResult } from '../models/search.js';

interface IFavoriteSearchResultsData {
    stage: PromiseStage;
    results?: IQuerySearchResult[];
    error?: unknown;
    actualStage: PromiseStage;
    retry: () => void;
}

export const useFavoriteSearchResults = (queries: ISearchQuery[], isEnabled: boolean = true): IFavoriteSearchResultsData => {
    const selectedDate = useValueNotifierContext(SelectedDateContext);
    const dateForSearch = useDateForSearch();

    const retrieveFavoriteSearchResults = useCallback(async () => {
        if (queries.length === 0 || !isEnabled) {
            return [];
        }

        return DiningClient.retrieveFavoriteSearchResults(queries, dateForSearch);
    }, [queries, dateForSearch]);

    const { stage, value, actualStage, error, run } = useDelayedPromiseState(
        retrieveFavoriteSearchResults,
        true /*keepLastValue*/
    );

    useEffect(() => {
        run();
    }, [run]);

    const filteredResults = useMemo(
        () => {
            return value?.filter(item => isAnyDateToday(item.locationDatesByCafeId, selectedDate));
        },
        [value, selectedDate]
    );

    return { stage, results: filteredResults, actualStage, error, retry: run };
};