import { SearchUtil } from '@msdining/common';
import React, { useContext, useMemo } from 'react';
import { DiningClient } from '../../api/dining.ts';
import { ApplicationContext } from '../../context/app.ts';
import { IQuerySearchResult, SearchEntityFilterType } from '../../models/search.ts';
import { matchesEntityFilter } from '../../util/search.ts';
import { SearchResult } from './search-result.tsx';
import { useValueNotifier } from '../../hooks/events.ts';
import { ApplicationSettings } from '../../api/settings.ts';
import { useIsPriceAllowed } from '../../hooks/cafe.ts';
import { ISearchResult, SearchEntityType } from '@msdining/common/dist/models/search';

const useFilteredResults = (searchResults: IQuerySearchResult[]) => {
    const enablePriceFilters = useValueNotifier(ApplicationSettings.enablePriceFilters);
    const isPriceAllowed = useIsPriceAllowed();

    return useMemo(
        () => {
            if (!enablePriceFilters) {
                return searchResults;
            }

            return searchResults.filter(searchResult => {
                if (searchResult.entityType !== SearchEntityType.menuItem) {
                    return true;
                }

                return Array.from(searchResult.prices).some(isPriceAllowed);
            });
        },
        [searchResults, enablePriceFilters, isPriceAllowed]
    );
}

interface ISearchResultsListProps {
    queryText: string;
    searchResults: IQuerySearchResult[];
    filter: SearchEntityFilterType;
}

export const SearchResultsList: React.FC<ISearchResultsListProps> = ({ queryText, searchResults, filter }) => {
    const { cafes, viewsById } = useContext(ApplicationContext);

    // TODO: Make SearchUtil.sortSearchResults take a generic param and extend ISearchResult
    const filteredResults: ISearchResult[] = useFilteredResults(searchResults);

    const entriesInOrder = useMemo(
        () => {
            const cafePriorityOrder = DiningClient.getCafePriorityOrder(cafes, viewsById);

            return SearchUtil.sortSearchResults({
                queryText,
                searchResults:     filteredResults,
                cafePriorityOrder: cafePriorityOrder.map(cafe => cafe.id)
            });
        },
        [filteredResults, queryText, cafes, viewsById]
    );

    const searchResultElements = useMemo(
        () => entriesInOrder.map(searchResult => (
            <SearchResult
                key={`${searchResult.entityType}.${searchResult.name}`}
                isVisible={matchesEntityFilter(filter, searchResult.entityType)}
                name={searchResult.name}
                description={searchResult.description}
                locationDatesByCafeId={searchResult.locationDatesByCafeId}
                imageUrl={searchResult.imageUrl}
                entityType={searchResult.entityType}
            />
        )),
        [entriesInOrder, filter]
    );

    return (
        <div className="search-results">
            {searchResultElements}
        </div>
    );
};