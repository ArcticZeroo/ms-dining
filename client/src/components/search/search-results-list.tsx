import React, { useContext, useMemo } from 'react';
import { ApplicationContext } from '../../context/app.ts';
import { useIsPriceAllowed } from '../../hooks/cafe.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { IQuerySearchResult, SearchEntityFilterType, SearchResultsViewMode } from '../../models/search.ts';
import { matchesEntityFilter } from '../../util/search.ts';
import { pluralize } from '../../util/string.ts';
import { SearchResult } from './search-result.tsx';
import { ISearchResultSortingContext, sortSearchResultsInPlace } from '../../util/search-sorting.ts';
import { PassiveUserLocationNotifier, PromptingUserLocationNotifier } from '../../api/location/user-location.ts';
import { ApplicationSettings } from '../../constants/settings.ts';
import { sortCafesInPriorityOrder } from '../../util/sorting.ts';

const useSortContext = (queryText: string, shouldPromptUserForLocation: boolean): ISearchResultSortingContext => {
    const { cafes, viewsById } = useContext(ApplicationContext);

    const targetLocationProvider = shouldPromptUserForLocation ? PromptingUserLocationNotifier : PassiveUserLocationNotifier;
    const userLocation = useValueNotifier(targetLocationProvider);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);
    const homepageViewIds = useValueNotifier(ApplicationSettings.homepageViews);
    const favoriteItemNames = useValueNotifier(ApplicationSettings.favoriteItemNames);
    const favoriteStationNames = useValueNotifier(ApplicationSettings.favoriteStationNames);

    const cafePriorityOrder = useMemo(() => sortCafesInPriorityOrder(cafes, viewsById), [cafes, viewsById]);

    return useMemo(() => {
        return {
            queryText,
            viewsById,
            userLocation,
            homepageViewIds,
            favoriteItemNames,
            favoriteStationNames,
            isUsingGroups: shouldUseGroups,
            cafePriorityOrder: cafePriorityOrder.map(cafe => cafe.id),
        };
    }, [cafePriorityOrder, favoriteItemNames, favoriteStationNames, homepageViewIds, queryText, shouldUseGroups, userLocation, viewsById]);
}

const getClassForViewMode = (viewMode: SearchResultsViewMode) => {
    if (viewMode === SearchResultsViewMode.vertical) {
        return 'flex-col';
    }

    if (viewMode === SearchResultsViewMode.horizontalWrap) {
        return 'flex flex-around flex-wrap';
    }

    if (viewMode === SearchResultsViewMode.horizontalScroll) {
        return 'flex flex-around search-results-horizontal';
    }
}

interface ISearchResultsListProps {
    queryText: string;
    searchResults: IQuerySearchResult[];
    filter: SearchEntityFilterType;
    isCompact?: boolean;
    limit?: number;
    showEndOfResults?: boolean;
    showSearchButtonInsteadOfLocations?: boolean;
    shouldStretchResults?: boolean;
    viewMode?: SearchResultsViewMode;
    shouldPromptUserForLocation?: boolean;
}

export const SearchResultsList: React.FC<ISearchResultsListProps> = ({ queryText, searchResults, filter, isCompact, limit, showEndOfResults = true, showSearchButtonInsteadOfLocations = false, shouldStretchResults, viewMode, shouldPromptUserForLocation = true }) => {
    const enablePriceFilters = useValueNotifier(ApplicationSettings.enablePriceFilters);
    const shouldUseCompactMode = useValueNotifier(ApplicationSettings.shouldUseCompactMode);
    const getIsPriceAllowed = useIsPriceAllowed();

    if (isCompact == null) {
        isCompact = shouldUseCompactMode;
    }

    if (viewMode == null) {
        viewMode = shouldUseCompactMode
            ? SearchResultsViewMode.horizontalWrap
            : SearchResultsViewMode.vertical;
    }

    if (shouldStretchResults == null) {
        shouldStretchResults = shouldUseCompactMode;
    }

    const searchSortingContext = useSortContext(queryText, shouldPromptUserForLocation);

    const entriesInOrder = useMemo(
        () => {
            const sortedSearchResults = sortSearchResultsInPlace(
                [...searchResults],
                searchSortingContext
            );
            
            if (limit != null) {
                return sortedSearchResults.slice(0, limit);
            }

            return sortedSearchResults;
        },
        [searchResults, searchSortingContext, limit]
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
                        isCompact={isCompact}
                        showFavoriteButton={true}
                        showSearchButtonInsteadOfLocations={showSearchButtonInsteadOfLocations}
                        shouldStretchResults={shouldStretchResults}
                    />
                );
            });

            return [priceFilterHiddenResultCount, searchResultElements];
        },
        [enablePriceFilters, entriesInOrder, filter, getIsPriceAllowed, isCompact, shouldStretchResults, showSearchButtonInsteadOfLocations]
    );

    return (
        <div className={getClassForViewMode(viewMode)}>
            {
                priceFilterHiddenResultCount > 0 && (
                    <div className="hidden-results">
                        {priceFilterHiddenResultCount} {pluralize('result', priceFilterHiddenResultCount)} hidden due to
                        price filters
                    </div>
                )
            }
            {searchResultElements}
            {showEndOfResults && entriesInOrder.length > 0 && (
                <div className="text-center">
                    End of Results
                </div>
            )}
        </div>
    );
};