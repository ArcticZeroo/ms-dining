import { IQuerySearchResult, SearchEntityFilterType } from '../../models/search.ts';
import React, { useContext, useMemo } from 'react';
import { SearchResult } from './search-result.tsx';
import { SearchUtil } from '@msdining/common';
import { ApplicationContext } from '../../context/app.ts';
import { matchesEntityFilter } from '../../util/search.ts';
import { DiningClient } from '../../api/dining.ts';

interface ISearchResultsListProps {
    queryText: string;
    searchResults: IQuerySearchResult[];
    filter: SearchEntityFilterType;
}

export const SearchResultsList: React.FC<ISearchResultsListProps> = ({ queryText, searchResults, filter }) => {
    const { cafes, viewsById } = useContext(ApplicationContext);

    const entriesInOrder = useMemo(
        () => {
            const cafePriorityOrder = DiningClient.getCafePriorityOrder(cafes, viewsById);
            return SearchUtil.sortSearchResults({
                searchResults,
                queryText,
                cafePriorityOrder: cafePriorityOrder.map(cafe => cafe.id)
            });
        },
        [searchResults, queryText, cafes, viewsById]
    );

    return (
        <div className="search-results">
            {
                entriesInOrder.map(searchResult => (
                    <SearchResult
                        key={`${searchResult.entityType}.${searchResult.name}`}
                        isVisible={matchesEntityFilter(filter, searchResult.entityType)}
                        name={searchResult.name}
                        description={searchResult.description}
                        locationDatesByCafeId={searchResult.locationDatesByCafeId}
                        imageUrl={searchResult.imageUrl}
                        entityType={searchResult.entityType}
                    />
                ))
            }
        </div>
    );
};