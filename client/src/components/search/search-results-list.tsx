import { SearchUtil } from '@msdining/common';
import React, { useContext, useMemo } from 'react';
import { DiningClient } from '../../api/dining.ts';
import { ApplicationSettings } from '../../api/settings.ts';
import { ApplicationContext } from '../../context/app.ts';
import { useIsPriceAllowed } from '../../hooks/cafe.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { IQuerySearchResult, SearchEntityFilterType } from '../../models/search.ts';
import { matchesEntityFilter } from '../../util/search.ts';
import { pluralize } from '../../util/string.ts';
import { SearchResult } from './search-result.tsx';

interface ISearchResultsListProps {
    queryText: string;
    searchResults: IQuerySearchResult[];
    filter: SearchEntityFilterType;
}

export const SearchResultsList: React.FC<ISearchResultsListProps> = ({ queryText, searchResults, filter }) => {
    const { cafes, viewsById } = useContext(ApplicationContext);
    
    const enablePriceFilters = useValueNotifier(ApplicationSettings.enablePriceFilters);
    const getIsPriceAllowed = useIsPriceAllowed();

    const entriesInOrder = useMemo(
        () => {
            const cafePriorityOrder = DiningClient.getCafePriorityOrder(cafes, viewsById);

            return SearchUtil.sortSearchResults({
                queryText,
                searchResults,
                cafePriorityOrder: cafePriorityOrder.map(cafe => cafe.id)
            });
        },
        [searchResults, queryText, cafes, viewsById]
        // TODO: Make sortSearchResults take a generic param
    ) as IQuerySearchResult[];
    
    const [priceFilterHiddenResultCount, searchResultElements] = useMemo(
        () => {
            let priceFilterHiddenResultCount = 0;

            const searchResultElements = entriesInOrder.map(searchResult => {
                const isPriceAllowed = !enablePriceFilters || Array.from(searchResult.prices).some(getIsPriceAllowed);

                if (!isPriceAllowed) {
                    priceFilterHiddenResultCount++;
                }

                return (
                    <SearchResult
                        key={`${searchResult.entityType}.${searchResult.name}`}
                        isVisible={isPriceAllowed && matchesEntityFilter(filter, searchResult.entityType)}
                        name={searchResult.name}
                        description={searchResult.description}
                        locationDatesByCafeId={searchResult.locationDatesByCafeId}
                        imageUrl={searchResult.imageUrl}
                        entityType={searchResult.entityType}
                    />
                );
            });

            return [priceFilterHiddenResultCount, searchResultElements];
        },
        [enablePriceFilters, entriesInOrder, filter, getIsPriceAllowed]
    );

    return (
        <div className="search-results">
            {
                priceFilterHiddenResultCount > 0 && (
                    <div className="hidden-results">
                        {priceFilterHiddenResultCount} {pluralize('result', priceFilterHiddenResultCount)} hidden due to price filters
                    </div>
                )
            }
            {searchResultElements}
        </div>
    );
};