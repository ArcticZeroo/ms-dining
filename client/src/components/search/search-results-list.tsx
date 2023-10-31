import { ISearchResult, SearchEntityFilterType } from '../../models/search.ts';
import React, { useContext, useMemo } from 'react';
import { SearchResult } from './search-result.tsx';
import { sortSearchResults } from '../../util/sorting.ts';
import { ApplicationContext } from '../../context/app.ts';
import { matchesEntityFilter } from '../../util/search.ts';

interface ISearchResultsListProps {
    queryText: string;
    searchResults: ISearchResult[];
    filter: SearchEntityFilterType;
}

export const SearchResultsList: React.FC<ISearchResultsListProps> = ({ queryText, searchResults, filter }) => {
    const { cafes, viewsById } = useContext(ApplicationContext);

    const entriesInOrder = useMemo(
        () => sortSearchResults({
            searchResults,
            queryText,
            cafes,
            viewsById
        }),
        [searchResults, queryText, cafes, viewsById]
    );

    return (
        <div className="search-results">
            {
                entriesInOrder.map(searchResult => (
                    <SearchResult
                        key={`${searchResult.entityType}.${searchResult.name}`}
                        result={searchResult}
                        isVisible={matchesEntityFilter(filter, searchResult.entityType)}
                    />
                ))
            }
        </div>
    );
};