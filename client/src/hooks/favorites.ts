import { ISearchQuery } from '@msdining/common/models/search';
import { useMemo } from 'react';
import { useValueNotifierContext } from './events.js';
import { SelectedDateContext } from '../context/time.js';
import { useDateForSearch } from './date-picker.js';
import { isAnyDateToday } from '../util/search.js';
import { IQuerySearchResult } from '../models/search.js';
import { useFavoriteSearchResultsQuery } from '../store/queries/search.ts';

export interface IFavoriteSearchResultsData {
    isPending: boolean;
    isError: boolean;
    results: IQuerySearchResult[] | undefined;
    retry: () => void;
}

export const useFavoriteSearchResults = (queries: ISearchQuery[], isEnabled: boolean = true): IFavoriteSearchResultsData => {
    const selectedDate = useValueNotifierContext(SelectedDateContext);
    const dateForSearch = useDateForSearch();

    const query = useFavoriteSearchResultsQuery(queries, dateForSearch, isEnabled);

    const filteredResults = useMemo(
        () => query.data?.filter(item => isAnyDateToday(item.locationDatesByCafeId, selectedDate)),
        [query.data, selectedDate]
    );

    return {
        isPending: query.isPending,
        isError:   query.isError,
        results:   filteredResults,
        retry:     () => {
            void query.refetch();
        },
    };
};