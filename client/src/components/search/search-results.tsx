import { ISearchResult, SearchResultsByItemName } from '../../models/search.ts';
import React, { useEffect, useState } from 'react';
import { SearchResult } from './search-result.tsx';

interface ISearchResultsProps {
    searchResultsByItemName: SearchResultsByItemName;
}

export const SearchResults: React.FC<ISearchResultsProps> = ({ searchResultsByItemName }) => {
    const [entriesInOrder, setEntriesInOrder] = useState<Array<[string, ISearchResult]>>([]);

    useEffect(() => {
        setEntriesInOrder(Array.from(searchResultsByItemName.entries()).sort(([, a], [, b]) => a.stableId - b.stableId));
    }, [searchResultsByItemName]);

    return (
        <div className="search-results">
            {
                entriesInOrder.map(([itemName, searchResult]) => (
                    <SearchResult name={itemName}
                                  diningHallIds={searchResult.diningHallIds}
                                  imageUrl={searchResult.imageUrl}
                                  key={searchResult.stableId}/>
                ))
            }
        </div>
    );
};