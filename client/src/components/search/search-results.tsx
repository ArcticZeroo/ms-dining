import { ISearchResult, SearchResultsByItemName } from '../../models/search.ts';
import React, { useContext, useEffect, useState } from 'react';
import { SearchResult } from './search-result.tsx';
import { sortSearchResults } from '../../util/sorting.ts';
import { ApplicationContext } from '../../context/app.ts';

interface ISearchResultsProps {
    queryText: string;
    searchResultsByItemName: SearchResultsByItemName;
}

export const SearchResults: React.FC<ISearchResultsProps> = ({ queryText, searchResultsByItemName }) => {
    const { cafes, viewsById } = useContext(ApplicationContext);
    const [entriesInOrder, setEntriesInOrder] = useState<Array<[string, ISearchResult]>>([]);

    useEffect(() => {
        setEntriesInOrder(sortSearchResults({
            searchResultsByItemName,
            queryText,
            cafes,
            viewsById
        }));
    }, [searchResultsByItemName, queryText, cafes, viewsById]);

    return (
        <div className="search-results">
            {
                entriesInOrder.map(([itemName, searchResult]) => (
                    <SearchResult name={itemName}
                                  cafeIds={searchResult.cafeIds}
                                  imageUrl={searchResult.imageUrl}
                                  key={searchResult.stableId}/>
                ))
            }
        </div>
    );
};