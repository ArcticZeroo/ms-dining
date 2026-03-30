import React, { useContext, useMemo } from 'react';
import { ApplicationContext } from '../../context/app.ts';
import { useIsPriceAllowed } from '../../hooks/cafe.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { useSortContext } from '../../hooks/search-sorting.ts';
import { IQuerySearchResult, SearchEntityFilterType, SearchResultsViewMode } from '../../models/search.ts';
import { matchesEntityFilter } from '../../util/search.ts';
import { pluralize } from '../../util/string.ts';
import { SearchResult } from './search-result.tsx';
import { sortSearchResultsInPlace } from '../../util/search-sorting.ts';
import { ApplicationSettings } from '../../constants/settings.ts';
import { useExpandedViewIds } from '../../hooks/search.js';

const getClassForViewMode = (viewMode: SearchResultsViewMode) => {
    if (viewMode === SearchResultsViewMode.vertical) {
        return 'flex-col';
    }

    if (viewMode === SearchResultsViewMode.horizontalWrap) {
        return 'flex flex-around flex-wrap';
    }

    if (viewMode === SearchResultsViewMode.horizontalScroll) {
        return 'flex horizontal-scroll';
    }
}

const filterLocations = (searchResult: IQuerySearchResult, allowedViewIds: Set<string>) => {
    if (allowedViewIds.size === 0) {
        return searchResult.locationDatesByCafeId;
    }

    const filteredLocations: Map<string, Array<Date>> = new Map();

    for (const [cafeId, dates] of searchResult.locationDatesByCafeId.entries()) {
        if (allowedViewIds.has(cafeId)) {
            filteredLocations.set(cafeId, dates);
        }
    }

    return filteredLocations;
}

interface ISearchResultsListProps {
    queryText: string;
    searchResults: IQuerySearchResult[];
    filter: SearchEntityFilterType;
    allowedViewIds?: Set<string>;
    isCompact?: boolean;
    limit?: number;
    showEndOfResults?: boolean;
    showOnlyCafeNames?: boolean;
    shouldStretchResults?: boolean;
    viewMode?: SearchResultsViewMode;
    shouldPromptUserForLocation?: boolean;
    showSearchButtonInsteadOfLocations?: boolean;
    noResultsView?: React.ReactNode;
}

export const SearchResultsList: React.FC<ISearchResultsListProps> = ({
    queryText,
    searchResults,
    filter,
    isCompact,
    limit,
    allowedViewIds = new Set(),
    showEndOfResults = true,
    showOnlyCafeNames = false,
    shouldStretchResults,
    viewMode,
    shouldPromptUserForLocation = true,
    showSearchButtonInsteadOfLocations = false,
    noResultsView
}) => {
    const { viewsById } = useContext(ApplicationContext);
    const enablePriceFilters = useValueNotifier(ApplicationSettings.enablePriceFilters);
    const shouldUseCompactMode = useValueNotifier(ApplicationSettings.shouldUseCompactMode);
    const getIsPriceAllowed = useIsPriceAllowed();

    const expandedAllowedViewIds = useExpandedViewIds(allowedViewIds, viewsById);

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

    const [filterHiddenResultCount, searchResultElements] = useMemo(
        () => {
            let filterHiddenResultCount = 0;

            const searchResultElements = entriesInOrder.map(searchResult => {
                const isPriceAllowed = !enablePriceFilters || Array.from(searchResult.priceByCafeId.values()).some(getIsPriceAllowed);
                const filteredLocationDatesByCafeId = filterLocations(searchResult, expandedAllowedViewIds);

                if (!isPriceAllowed || (searchResult.locationDatesByCafeId.size !== 0 && filteredLocationDatesByCafeId.size === 0)) {
                    filterHiddenResultCount++;
                }

                // Search results show up but with "Not available this week" if there are no hits, since we do matching
                // that allows hits for items by name even if they are not available at any location. But if we are filtering
                // by view and there are no locations in the allowed views, we should just hide the result entirely.
                if (expandedAllowedViewIds.size > 0 && filteredLocationDatesByCafeId.size === 0) {
                    return null;
                }

                return (
                    <SearchResult
                        key={searchResult.id}
                        isVisible={isPriceAllowed && matchesEntityFilter(filter, searchResult.entityType)}
                        name={searchResult.name}
                        description={searchResult.description}
                        locationDatesByCafeId={filteredLocationDatesByCafeId}
                        priceByCafeId={searchResult.priceByCafeId}
                        stationByCafeId={searchResult.stationByCafeId}
                        imageUrl={searchResult.imageUrl}
                        entityType={searchResult.entityType}
                        tags={searchResult.tags}
                        searchTags={searchResult.searchTags}
                        isCompact={isCompact}
                        showFavoriteButton={true}
                        showOnlyCafeNames={showOnlyCafeNames}
                        shouldStretchResults={shouldStretchResults}
                        showSearchButtonInsteadOfLocations={showSearchButtonInsteadOfLocations}
                        matchReasons={searchResult.matchReasons}
                        matchedModifiers={searchResult.matchedModifiers}
                        cafeId={searchResult.cafeId}
                        overallRating={searchResult.overallRating}
                        totalReviewCount={searchResult.totalReviewCount}
                    />
                );
            });

            return [filterHiddenResultCount, searchResultElements];
        },
        [enablePriceFilters, entriesInOrder, expandedAllowedViewIds, filter, getIsPriceAllowed, isCompact, shouldStretchResults, showOnlyCafeNames, showSearchButtonInsteadOfLocations]
    );

    return (
        <div className={getClassForViewMode(viewMode)}>
            {
                filterHiddenResultCount > 0 && (
                    <div className="hidden-results">
                        {filterHiddenResultCount} {pluralize('result', filterHiddenResultCount)} hidden due to filters
                    </div>
                )
            }
            {searchResultElements}
            {showEndOfResults && entriesInOrder.length > 0 && (
                <div className="text-center">
                    End of Results
                </div>
            )}
            {entriesInOrder.length === 0 && noResultsView}
        </div>
    );
};