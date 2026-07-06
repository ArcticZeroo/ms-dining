import type { SearchEntityType } from '@msdining/common/models/search';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SearchEntityFilterType, type IQuerySearchResult } from '../models/search.ts';
import { useSearchResultsQuery } from '../store/queries/search.ts';
import { useDateForSearch } from './date-picker.tsx';

const getSearchResultTabCounts = (results: IQuerySearchResult[]) => {
    const counts = new Map<SearchEntityType, number>();

    for (const result of results) {
        const count = counts.get(result.entityType) ?? 0;
        counts.set(result.entityType, count + 1);
    }

    return counts;
};

export const useSearchPageWithQuery = (queryText: string) => {
    const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
    const [entityFilterType, setEntityFilterType] = useState<SearchEntityFilterType>(SearchEntityFilterType.all);
    const dateForSearch = useDateForSearch();

    const searchQuery = useSearchResultsQuery(queryText, dateForSearch);
    const results = useMemo(() => searchQuery.data ?? [], [searchQuery.data]);
    const tabCounts = useMemo(() => getSearchResultTabCounts(results), [results]);

    const toggleFilterMenu = useCallback(() => {
        setIsFilterMenuOpen(!isFilterMenuOpen);
    }, [isFilterMenuOpen]);

    const retrySearch = useCallback(() => {
        void searchQuery.refetch();
    }, [searchQuery]);

    useEffect(() => {
        setEntityFilterType(SearchEntityFilterType.all);
    }, [queryText]);

    return {
        entityFilterType,
        isError: searchQuery.isError,
        isFetching: searchQuery.isFetching,
        isFilterMenuOpen,
        isSuccess: searchQuery.isSuccess,
        results,
        retrySearch,
        setEntityFilterType,
        tabCounts,
        toggleFilterMenu,
    };
};
