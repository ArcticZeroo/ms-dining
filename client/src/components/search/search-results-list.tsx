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
import { expandAndFlattenView } from "../../util/view.ts";

const useSortContext = (queryText: string, shouldPromptUserForLocation: boolean): ISearchResultSortingContext => {
    const { cafes, viewsById } = useContext(ApplicationContext);

    const targetLocationProvider = shouldPromptUserForLocation
        ? PromptingUserLocationNotifier
        : PassiveUserLocationNotifier;
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

    const expandedAllowedViewIds = useMemo(
        (): Set<string> => {
            if (allowedViewIds.size === 0) {
                return new Set();
            }
            
            const viewIds = new Set(allowedViewIds);
            for (const allowedViewId of allowedViewIds) {
                const view = viewsById.get(allowedViewId);
                if (view == null) {
                    continue;
                }

                for (const cafe of expandAndFlattenView(view, viewsById)) {
                    viewIds.add(cafe.id);
                }
            }
            
            return viewIds;
        },
        [allowedViewIds, viewsById]
    );

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
                const locationDatesByCafeId = filterLocations(searchResult, expandedAllowedViewIds);

                if (!isPriceAllowed || (searchResult.locationDatesByCafeId.size !== 0 && locationDatesByCafeId.size === 0)) {
                    filterHiddenResultCount++;
                }

                return (
                    <SearchResult
                        key={`${searchResult.entityType}.${searchResult.name}`}
                        isVisible={isPriceAllowed && matchesEntityFilter(filter, searchResult.entityType)}
                        name={searchResult.name}
                        description={searchResult.description}
                        locationDatesByCafeId={locationDatesByCafeId}
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