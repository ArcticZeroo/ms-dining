import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import { useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { useVisibleViewsForNav } from './views.ts';
import { useSortContext } from './search-sorting.ts';
import { computeLabelModes, MarkerLabelMode } from '../util/map.ts';
import { matchesEntityFilter } from '../util/search.ts';
import { sortSearchResultsInPlace } from '../util/search-sorting.ts';
import { CafeView } from '../models/cafe.ts';
import { IQuerySearchResult, SearchEntityFilterType } from '../models/search.ts';
import { DiningClient } from '../api/client/dining.ts';

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

export const useMapSearch = (query: string) => {
    const [entityFilter, setEntityFilter] = useState<SearchEntityFilterType>(SearchEntityFilterType.all);

    const { value: searchResults, stage: searchResultStage, run: retrySearch } = useSearchResults(query);

    const searchSortingContext = useSortContext(query, false /*shouldPromptUserForLocation*/);

    const sortedResults = useMemo(() => {
        if (!searchResults) {
            return undefined;
        }

        return sortSearchResultsInPlace([...searchResults], searchSortingContext);
    }, [searchResults, searchSortingContext]);

    const visibleResults = useMemo(() => {
        if (!sortedResults) {
            return undefined;
        }

        return sortedResults.filter(result => matchesEntityFilter(entityFilter, result.entityType));
    }, [sortedResults, entityFilter]);

    const searchResultCafeIds = useMemo(() => {
        if (!visibleResults || visibleResults.length === 0) {
            return undefined;
        }

        const ids = new Set<string>();
        for (const result of visibleResults) {
            if (result.cafeId) {
                ids.add(result.cafeId);
            }
            for (const cafeId of result.locationDatesByCafeId.keys()) {
                ids.add(cafeId);
            }
        }
        return ids;
    }, [visibleResults]);

    useEffect(() => {
        setEntityFilter(SearchEntityFilterType.all);
    }, [query]);

    return {
        sortedResults,
        visibleResults,
        searchResultCafeIds,
        entityFilter,
        setEntityFilter,
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


