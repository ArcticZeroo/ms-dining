import { useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    useMapHighlight,
    useMapPageOverviewSelectedView,
    useMapSearch,
    useMapSearchFilterViews
} from '../../../hooks/map.js';
import {
    IMapSearchContext,
    MapHighlightContext,
    MapSearchContext,
    useMapHighlightContext,
    useMapSearchContext
} from '../../../context/map.js';
import { classNames } from '../../../util/react.js';
import { MapSearchResultDetail } from './map-search-result-detail.js';
import { MapSidePanel } from './map-side-panel.js';
import { CafeView } from '../../../models/cafe.js';
import { usePageData } from '../../../hooks/location.js';
import { getViewName } from '../../../util/cafe.js';
import FullMapView from '../../map/full-map-view.js';

const MapPageViewContent = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const query = searchParams.get('q') ?? '';

    const { searchResultCafeIds } = useMapSearchContext();
    const { selectedSearchResult, effectiveHighlightedCafeIds, onCloseDetail } = useMapHighlightContext();

    const { selectedViewIds } = useMapSearchFilterViews();
    const overviewSelectedView = useMapPageOverviewSelectedView();

    const effectiveSearchResultCafeIds = useMemo(() => {
        if (selectedSearchResult) {
            return new Set(selectedSearchResult.locationDatesByCafeId.keys());
        }
        return searchResultCafeIds;
    }, [selectedSearchResult, searchResultCafeIds]);

    const pageTitle = useMemo(() => {
        if (query) {
            return `Map - Search for "${query}"`;
        }

        if (overviewSelectedView) {
            return `Map - ${getViewName({
                view: overviewSelectedView,
                showGroupName: true,
                includeEmoji: true
            })}`;
        }

        return 'Map';
    }, [overviewSelectedView, query]);

    usePageData(pageTitle, 'View cafes and search for menu items on the campus map.');

    const onSelectView = useCallback((view: CafeView, isMultiSelect: boolean) => {
        if (query.length > 0) {
            // Search mode: toggle filter via ?views= query param
            setSearchParams(prev => {
                const next = new URLSearchParams(prev);

                const newSelectedViewIds = new Set(selectedViewIds);

                if (isMultiSelect) {
                    if (newSelectedViewIds.has(view.value.id)) {
                        newSelectedViewIds.delete(view.value.id);
                    } else {
                        newSelectedViewIds.add(view.value.id);
                    }
                } else {
                    // Not multi-select, so there are three options:
                    // 1. We were just in multi-select and are clicking one cafe that was already selected, so keep only that one
                    // 2. We are not in multi-select and are clicking the only-selected cafe, so we want to deselect it
                    // 3. We were clicking a cafe that was not selected before, so keep only that one
                    
                    if (newSelectedViewIds.size > 1 && newSelectedViewIds.has(view.value.id)) {
                        // Case 1: Keep only the clicked cafe
                        newSelectedViewIds.clear();
                        newSelectedViewIds.add(view.value.id);
                    } else if (newSelectedViewIds.size === 1 && newSelectedViewIds.has(view.value.id)) {
                        // Case 2: Deselect the only selected cafe
                        newSelectedViewIds.clear();
                    } else {
                        // Case 3: Keep only the clicked cafe
                        newSelectedViewIds.clear();
                        newSelectedViewIds.add(view.value.id);
                    }
                }

                if (newSelectedViewIds.size === 0) {
                    next.delete('views');
                } else {
                    next.set('views', Array.from(newSelectedViewIds).join('+'));
                }
                return next;
            }, { replace: true });
        } else {
            // No search: navigate to overview
            const isAlreadySelected = overviewSelectedView?.value.id === view.value.id;
            if (isAlreadySelected) {
                navigate('/map');
            } else {
                navigate(`/map/overview/${view.value.id}`);
            }
        }
    }, [query.length, setSearchParams, selectedViewIds, overviewSelectedView?.value.id, navigate]);

    const selectedCafeIds = useMemo(() => {
        if (!selectedSearchResult) {
            return undefined;
        }
        return new Set(selectedSearchResult.locationDatesByCafeId.keys());
    }, [selectedSearchResult]);

    return (
        <>
            {selectedSearchResult && (
                <MapSearchResultDetail
                    result={selectedSearchResult}
                    onClose={onCloseDetail}
                />
            )}
            <div className="map-area">
                <FullMapView
                    onSelectView={onSelectView}
                    highlightedCafeIds={effectiveHighlightedCafeIds}
                    searchResultCafeIds={effectiveSearchResultCafeIds}
                    selectedCafeIds={selectedCafeIds}
                />
            </div>
        </>
    );
};

export const MapPageView = () => {
    const [searchParams] = useSearchParams();
    const query = searchParams.get('q') ?? '';

    const {
        allResults, entityFilteredResults, searchResultCafeIds,
        entityFilter, setEntityFilter,
        searchResultStage, retrySearch
    } = useMapSearch(query);

    const highlight = useMapHighlight(query);

    const searchContextValue = useMemo(() => ({
        query,
        entityFilter,
        setEntityFilter,
        allResults: allResults ?? [],
        entityFilteredResults: entityFilteredResults ?? [],
        searchResultCafeIds: searchResultCafeIds ?? new Set<string>(),
        stage: searchResultStage,
        retry: retrySearch
    } satisfies IMapSearchContext), [query, allResults, entityFilteredResults, searchResultCafeIds, entityFilter, setEntityFilter, searchResultStage, retrySearch]);

    return (
        <MapSearchContext.Provider value={searchContextValue}>
            <MapHighlightContext.Provider value={highlight}>
                <div className={classNames('map-page', highlight.selectedSearchResult && 'has-detail-card')}>
                    <MapSidePanel/>
                    <MapPageViewContent/>
                </div>
            </MapHighlightContext.Provider>
        </MapSearchContext.Provider>
    );
}