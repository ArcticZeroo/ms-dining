import React from 'react';
import { useAllowedSearchViewIds } from '../../../hooks/search.ts';
import { SearchEntityFilterType, type IQuerySearchResult } from '../../../models/search.ts';
import { SearchResultsList } from '../../search/search-results-list.tsx';

interface ISearchPageResultsProps {
    filter: SearchEntityFilterType;
    isSuccess: boolean;
    queryText: string;
    searchResults: IQuerySearchResult[];
}

export const SearchPageResults: React.FC<ISearchPageResultsProps> = ({
    filter,
    isSuccess,
    queryText,
    searchResults,
}) => {
    const allowedViewIds = useAllowedSearchViewIds();

    if (!isSuccess) {
        return null;
    }

    return (
        <SearchResultsList
            searchResults={searchResults}
            queryText={queryText}
            filter={filter}
            allowedViewIds={allowedViewIds}
        />
    );
};
