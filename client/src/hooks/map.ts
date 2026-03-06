import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import { useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { useVisibleViewsForNav } from './views.ts';
import { useSortContext } from './search-sorting.ts';
import { computeLabelModes, MarkerLabelMode } from '../util/map.ts';
import { matchesEntityFilter } from '../util/search.ts';
import { sortSearchResultsInPlace } from '../util/search-sorting.ts';
import { CafeView } from '../models/cafe.ts';
import { IQuerySearchResult, MapSearchSortType, SearchEntityFilterType } from '../models/search.ts';
import { DiningClient } from '../api/client/dining.ts';
import { useValueNotifier } from './events.js';
import { ApplicationSettings } from '../constants/settings.js';
import { ApplicationContext } from '../context/app.js';
import { useParams, useSearchParams } from 'react-router-dom';
import { getAllSingleCafesInView } from '../util/view.js';
import { getViewName } from '../util/cafe.js';
import { getDistanceBetweenCoordinates } from '../util/coordinates.ts';
import { getViewLocation } from '../util/view.ts';

export const useMapZoom = () => {
    const map = useMap();
    const [zoom, setZoom] = useState(map.getZoom());

    useMapEvents({
        zoomend: () => setZoom(map.getZoom())
    });

    return zoom;
};

export const useMarkerLabelModes = (): { views: CafeView[]; labelModes: Map<string, MarkerLabelMode> } => {
    const views = useVisibleViewsForNav(true /*shouldUseGroups*/);
    const map = useMap();
    const zoom = useMapZoom();

    const labelModes = useMemo(
        () => computeLabelModes(views, map, zoom),
        [views, map, zoom]
    );

    return { views, labelModes };
};

const useSearchResults = (query: string) => {
    const callback = useMemo(
        () => query.length > 0
            ? () => DiningClient.retrieveSearchResults({ query })
            : async () => [],
        [query]
    );

    return useImmediatePromiseState(callback);
};

const getMinPrice = (result: IQuerySearchResult): number | null => {
    const prices = Array.from(result.priceByCafeId.values());
    if (prices.length === 0) {
        return null;
    }
    return Math.min(...prices);
};

const getMinDistanceToUser = (
    result: IQuerySearchResult,
    userLocation: { lat: number; long: number },
    viewsById: Map<string, CafeView>
): number | null => {
    let minDistance: number | null = null;

    for (const cafeId of result.locationDatesByCafeId.keys()) {
        const cafeView = viewsById.get(cafeId);
        if (!cafeView) {
            continue;
        }

        const cafeLocation = getViewLocation(cafeView);
        const distance = getDistanceBetweenCoordinates(userLocation, cafeLocation, true /*inMiles*/);
        if (minDistance === null || distance < minDistance) {
            minDistance = distance;
        }
    }

    return minDistance;
};

const DISTANCE_BUCKET_SIZE = 0.1; // miles

const roundToNearest = (distance: number): number => {
    return Math.round(distance / DISTANCE_BUCKET_SIZE) * DISTANCE_BUCKET_SIZE;
};

const getMinDistanceToTargetCafes = (
    result: IQuerySearchResult,
    targetLocations: { lat: number; long: number }[],
    viewsById: Map<string, CafeView>
): number | null => {
    let minDistance: number | null = null;

    for (const cafeId of result.locationDatesByCafeId.keys()) {
        const cafeView = viewsById.get(cafeId);
        if (!cafeView) {
            continue;
        }

        const cafeLocation = getViewLocation(cafeView);
        for (const targetLocation of targetLocations) {
            const distance = getDistanceBetweenCoordinates(targetLocation, cafeLocation, true /*inMiles*/);
            if (minDistance === null || distance < minDistance) {
                minDistance = distance;
            }
        }
    }

    return minDistance;
};

export const useMapSearch = (query: string) => {
    const [entityFilter, setEntityFilter] = useState<SearchEntityFilterType>(SearchEntityFilterType.all);
    const sortType = useValueNotifier(ApplicationSettings.mapSearchSortType) as MapSearchSortType;

    const setSortType = useCallback((type: MapSearchSortType) => {
        ApplicationSettings.mapSearchSortType.value = type;
    }, []);

    const { value: searchResults, stage: searchResultStage, run: retrySearch } = useSearchResults(query);

    const searchSortingContext = useSortContext(query, false /*shouldPromptUserForLocation*/);

    const hasUserLocation = searchSortingContext.userLocation != null;
    const hasHomeCafes = searchSortingContext.homepageViewIds.size > 0;

    const homeCafeLocations = useMemo(() => {
        const locations: Array<{ lat: number; long: number }> = [];
        for (const viewId of searchSortingContext.homepageViewIds) {
            const view = searchSortingContext.viewsById.get(viewId);
            if (view) {
                locations.push(getViewLocation(view));
            }
        }
        return locations;
    }, [searchSortingContext.homepageViewIds, searchSortingContext.viewsById]);

    const allResults = useMemo(() => {
        if (!searchResults) {
            return undefined;
        }

        const results = [...searchResults];

        // Always sort by relevance first; stable sort preserves this
        // ordering as a tiebreaker for other sort modes.
        sortSearchResultsInPlace(results, searchSortingContext);

        switch (sortType) {
        case MapSearchSortType.relevance:
            break;
        case MapSearchSortType.price:
            results.sort((a, b) => {
                const priceA = getMinPrice(a);
                const priceB = getMinPrice(b);
                if (priceA === null && priceB === null) {
                    return 0;
                }
                if (priceA === null) {
                    return 1;
                }
                if (priceB === null) {
                    return -1;
                }
                return priceA - priceB;
            });
            break;
        case MapSearchSortType.proximity: {
            const userLocation = searchSortingContext.userLocation;
            if (userLocation) {
                results.sort((a, b) => {
                    const distA = getMinDistanceToUser(a, userLocation, searchSortingContext.viewsById);
                    const distB = getMinDistanceToUser(b, userLocation, searchSortingContext.viewsById);
                    if (distA === null && distB === null) {
                        return 0;
                    }
                    if (distA === null) {
                        return 1;
                    }
                    if (distB === null) {
                        return -1;
                    }
                    return roundToNearest(distA) - roundToNearest(distB);
                });
            }
            break;
        }
        case MapSearchSortType.homeCafeProximity: {
            if (homeCafeLocations.length > 0) {
                results.sort((a, b) => {
                    const distA = getMinDistanceToTargetCafes(a, homeCafeLocations, searchSortingContext.viewsById);
                    const distB = getMinDistanceToTargetCafes(b, homeCafeLocations, searchSortingContext.viewsById);
                    if (distA === null && distB === null) {
                        return 0;
                    }
                    if (distA === null) {
                        return 1;
                    }
                    if (distB === null) {
                        return -1;
                    }
                    return roundToNearest(distA) - roundToNearest(distB);
                });
            }
            break;
        }
        }

        return results;
    }, [searchResults, searchSortingContext, sortType, homeCafeLocations]);

    const entityFilteredResults = useMemo(() => {
        if (!allResults) {
            return undefined;
        }

        return allResults.filter(result => matchesEntityFilter(entityFilter, result.entityType));
    }, [allResults, entityFilter]);

    const searchResultCafeIds = useMemo(() => {
        if (!entityFilteredResults || entityFilteredResults.length === 0) {
            return undefined;
        }

        const ids = new Set<string>();
        for (const result of entityFilteredResults) {
            if (result.cafeId) {
                ids.add(result.cafeId);
            }
            for (const cafeId of result.locationDatesByCafeId.keys()) {
                ids.add(cafeId);
            }
        }
        return ids;
    }, [entityFilteredResults]);

    useEffect(() => {
        setEntityFilter(SearchEntityFilterType.all);
    }, [query]);

    return {
        allResults,
        entityFilteredResults,
        searchResultCafeIds,
        entityFilter,
        setEntityFilter,
        sortType,
        setSortType,
        hasUserLocation,
        hasHomeCafes,
        searchResultStage,
        retrySearch
    };
};

export const useMapHighlight = (query: string) => {
    const [highlightedCafeIds, setHighlightedCafeIds] = useState<Set<string>>(new Set());
    const [selectedSearchResult, setSelectedSearchResult] = useState<IQuerySearchResult | null>(null);

    useEffect(() => {
        setSelectedSearchResult(null);
    }, [query]);

    const onCloseDetail = useCallback(() => {
        setSelectedSearchResult(null);
        setHighlightedCafeIds(new Set());
    }, []);

    const effectiveHighlightedCafeIds = useMemo(() => {
        if (highlightedCafeIds.size > 0) {
            return highlightedCafeIds;
        }
        if (selectedSearchResult) {
            return new Set(selectedSearchResult.locationDatesByCafeId.keys());
        }
        return highlightedCafeIds;
    }, [highlightedCafeIds, selectedSearchResult]);

    return {
        selectedSearchResult,
        setSelectedSearchResult,
        setHighlightedCafeIds,
        effectiveHighlightedCafeIds,
        onCloseDetail
    };
};

export const useMapSearchFilterViews = () => {
    const homepageViewIds = useValueNotifier(ApplicationSettings.homepageViews);
    const { viewsById } = useContext(ApplicationContext);
    const [searchParams, setSearchParams] = useSearchParams();

    const viewsParam = searchParams.get('views');

    const [actualFilterViewIds, expandedFilterViewIds] = useMemo(() => {
        if (!viewsParam) {
            return [new Set<string>(), new Set<string>()];
        }

        const baseIds = viewsParam.split('+');
        const actualFilterViewIdSet = new Set<string>();
        const expandedViewIdSet = new Set<string>();
        for (const id of baseIds) {
            const view = viewsById.get(id);
            if (view) {
                expandedViewIdSet.add(view.value.id);
                actualFilterViewIdSet.add(view.value.id);
                const childViews = getAllSingleCafesInView(view, viewsById);
                for (const childView of childViews) {
                    expandedViewIdSet.add(childView.id);
                }
            }
        }

        return [actualFilterViewIdSet, expandedViewIdSet];
    }, [viewsParam, viewsById]);

    const isFilteredToHomeCafes = useMemo(() => {
        if (actualFilterViewIds.size === 0) {
            return false;
        }

        return actualFilterViewIds.size === homepageViewIds.size
            && Array.from(actualFilterViewIds).every(id => homepageViewIds.has(id));
    }, [actualFilterViewIds, homepageViewIds]);

    const onFilterToHomeCafes = useCallback(() => {
        const homeViewIds = Array.from(homepageViewIds)
            .filter(id => viewsById.has(id));
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('views', homeViewIds.join('+'));
            return next;
        }, { replace: true });
    }, [homepageViewIds, viewsById, setSearchParams]);

    const onClearFilteredViews = useCallback(() => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.delete('views');
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    const filterViewName = useMemo(() => {
        if (actualFilterViewIds.size === 0) {
            return undefined;
        }

        const viewIdsArray = Array.from(actualFilterViewIds);
        if (viewIdsArray.length === 1) {
            const firstViewId = viewIdsArray[0]!;
            const firstView = viewsById.get(firstViewId);

            if (!firstView) {
                throw new Error(`View with ID ${firstViewId} not found`);
            }

            return getViewName({ view: firstView, showGroupName: true, includeEmoji: true });
        }

        return `${viewIdsArray.length} cafes`;
    }, [actualFilterViewIds, viewsById]);

    return {
        isFilteringViews: actualFilterViewIds.size > 0,
        selectedViewIds: actualFilterViewIds,
        allowedViewIds: expandedFilterViewIds,
        isFilteredToHomeCafes,
        onFilterToHomeCafes,
        onClearFilteredViews,
        filterViewName
    };
};

export const useMapPageOverviewSelectedView = () => {
    const { viewsById } = useContext(ApplicationContext);
    const { viewId } = useParams<{ viewId: string }>();

    return useMemo(() => {
        if (!viewId) {
            return undefined;
        }

        return viewsById.get(viewId);
    }, [viewId, viewsById]);

}