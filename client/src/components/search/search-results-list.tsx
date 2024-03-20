import React, { useContext, useMemo } from 'react';
import { ApplicationContext } from '../../context/app.ts';
import { useIsPriceAllowed } from '../../hooks/cafe.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { IQuerySearchResult, SearchEntityFilterType } from '../../models/search.ts';
import { matchesEntityFilter } from '../../util/search.ts';
import { pluralize } from '../../util/string.ts';
import { SearchResult } from './search-result.tsx';
import { sortSearchResults } from '../../util/search-sorting.ts';
import { UserLocationNotifier } from '../../api/user-location.ts';
import { ApplicationSettings } from '../../constants/settings.ts';
import { sortCafesInPriorityOrder } from '../../util/sorting.ts';

interface ISearchResultsListProps {
    queryText: string;
    searchResults: IQuerySearchResult[];
    filter: SearchEntityFilterType;
}

export const SearchResultsList: React.FC<ISearchResultsListProps> = ({ queryText, searchResults, filter }) => {
    const { cafes, viewsById } = useContext(ApplicationContext);

    const userLocation = useValueNotifier(UserLocationNotifier);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);
    const enablePriceFilters = useValueNotifier(ApplicationSettings.enablePriceFilters);
    const homepageViewIds = useValueNotifier(ApplicationSettings.homepageViews);
    const getIsPriceAllowed = useIsPriceAllowed();

    const entriesInOrder = useMemo(
        () => {
            const cafePriorityOrder = sortCafesInPriorityOrder(cafes, viewsById);

            const sortedSearchResults = [...searchResults];

            return sortSearchResults(
                sortedSearchResults,
                {
                    queryText,
                    viewsById,
                    userLocation,
                    homepageViewIds,
                    isUsingGroups: shouldUseGroups,
                    cafePriorityOrder: cafePriorityOrder.map(cafe => cafe.id),
                }
            );
        },
        [cafes, viewsById, searchResults, queryText, userLocation, homepageViewIds, shouldUseGroups]
        // TODO: Make sortSearchResults take a generic param
    );

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
                        searchTags={searchResult.searchTags}
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
                        {priceFilterHiddenResultCount} {pluralize('result', priceFilterHiddenResultCount)} hidden due to
                        price filters
                    </div>
                )
            }
            {searchResultElements}
            {entriesInOrder.length > 0 && (
                <div className="centered-content">
                    End of Results
                </div>
            )}
        </div>
    );
};