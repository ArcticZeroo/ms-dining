import React, { Suspense, useCallback, useContext, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMapSearch, useMapHighlight } from '../../../hooks/map.js';
import {
    MapSearchContext, MapHighlightContext,
    useMapSearchContext, useMapHighlightContext
} from '../../../context/map.js';
import { ApplicationContext } from '../../../context/app.js';
import { classNames } from '../../../util/react.js';
import { MapSearchResultDetail } from './map-search-result-detail.js';
import { CampusMapViewSkeleton } from '../../map/campus-map-view-skeleton.js';
import { MapSidePanel } from './map-side-panel.js';
import { CafeView } from '../../../models/cafe.js';
import { usePageData } from '../../../hooks/location.js';
import { getViewName } from '../../../util/cafe.js';

const FullMapView = React.lazy(() => import('../../map/full-map-view.tsx'));

const MapPageViewContent = () => {
    const navigate = useNavigate();
    const { viewId } = useParams<{ viewId: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const query = searchParams.get('q') ?? '';
    const { viewsById } = useContext(ApplicationContext);

    const { searchResultCafeIds } = useMapSearchContext();
    const { selectedSearchResult, effectiveHighlightedCafeIds, onCloseDetail } = useMapHighlightContext();

    const selectedView = viewId ? viewsById.get(viewId) : undefined;

    const pageTitle = useMemo(() => {
        if (query) {
            return `Map - Search for "${query}"`;
        }
        if (selectedView) {
            return `Map - ${getViewName({ view: selectedView, showGroupName: true })}`;
        }
        return 'Map';
    }, [query, selectedView]);

    usePageData(pageTitle, 'View cafes and search for menu items on the campus map.');

    const selectedCafeIds = useMemo(() => {
        // Overview mode: single view selected via URL
        if (viewId) {
            const view = viewsById.get(viewId);
            if (view) {
                return new Set([view.value.id]);
            }
        }

        // Search filter mode: views selected via ?views= query param
        const viewsParam = searchParams.get('views');
        if (viewsParam) {
            return new Set(viewsParam.split('+').filter(id => viewsById.has(id)));
        }

        return new Set<string>();
    }, [viewId, searchParams, viewsById]);

    const onSelectView = useCallback((view: CafeView, isMultiSelect: boolean) => {
        if (query.length > 0) {
            // Search mode: toggle filter via ?views= query param
            setSearchParams(prev => {
                const next = new URLSearchParams(prev);
                const currentViews = prev.get('views')?.split('+').filter(id => viewsById.has(id)) ?? [];
                const viewIndex = currentViews.indexOf(view.value.id);

                if (isMultiSelect) {
                    if (viewIndex >= 0) {
                        currentViews.splice(viewIndex, 1);
                    } else {
                        currentViews.push(view.value.id);
                    }
                } else {
                    if (viewIndex >= 0 && currentViews.length === 1) {
                        next.delete('views');
                        return next;
                    }
                    currentViews.length = 0;
                    currentViews.push(view.value.id);
                }

                if (currentViews.length === 0) {
                    next.delete('views');
                } else {
                    next.set('views', currentViews.join('+'));
                }
                return next;
            }, { replace: true });
        } else {
            // No search: navigate to overview
            const isAlreadySelected = viewId === view.value.id;
            if (isAlreadySelected) {
                navigate('/map');
            } else {
                navigate(`/map/overview/${view.value.id}`);
            }
        }
    }, [query, viewId, navigate, setSearchParams, viewsById]);

    return (
        <>
            {selectedSearchResult && (
                <MapSearchResultDetail
                    result={selectedSearchResult}
                    onClose={onCloseDetail}
                />
            )}
            <div className="map-area">
                <Suspense fallback={<CampusMapViewSkeleton/>}>
                    <FullMapView
                        onSelectView={onSelectView}
                        highlightedCafeIds={effectiveHighlightedCafeIds}
                        selectedCafeIds={selectedCafeIds}
                        searchResultCafeIds={searchResultCafeIds}
                    />
                </Suspense>
            </div>
        </>
    );
};

export const MapPageView = () => {
    const [searchParams] = useSearchParams();
    const query = searchParams.get('q') ?? '';

    const {
        sortedResults, visibleResults, searchResultCafeIds,
        entityFilter, setEntityFilter,
        searchResultStage, retrySearch
    } = useMapSearch(query);

    const highlight = useMapHighlight(query);

    const searchContextValue = useMemo(() => ({
        query,
        sortedResults,
        visibleResults,
        searchResultCafeIds,
        entityFilter,
        setEntityFilter,
        stage: searchResultStage,
        retry: retrySearch
    }), [query, sortedResults, visibleResults, searchResultCafeIds, entityFilter, setEntityFilter, searchResultStage, retrySearch]);

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