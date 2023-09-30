import { ISearchResult, SearchEntityFilterType, SearchResultsMap } from '../../models/search.ts';
import React, { useContext, useEffect, useState } from 'react';
import { SearchResult } from './search-result.tsx';
import { sortSearchResults } from '../../util/sorting.ts';
import { ApplicationContext } from '../../context/app.ts';

interface ISearchResultsListProps {
    queryText: string;
    searchResults: SearchResultsMap;
    entityType: SearchEntityFilterType;
}

export const SearchResultsList: React.FC<ISearchResultsListProps> = ({ queryText, searchResults, entityType }) => {
    const { cafes, viewsById } = useContext(ApplicationContext);
    const [entriesInOrder, setEntriesInOrder] = useState<Array<ISearchResult>>([]);

    useEffect(() => {
        setEntriesInOrder(sortSearchResults({
            searchResults,
            queryText,
            cafes,
            viewsById,
            entityType
        }));
    }, [searchResults, queryText, cafes, viewsById, entityType]);

    return (
        <div className="search-results">
            {
                entriesInOrder.map(searchResult => (
                    <SearchResult result={searchResult}
                                  key={searchResult.stableId}/>
                ))
            }
        </div>
    );
};