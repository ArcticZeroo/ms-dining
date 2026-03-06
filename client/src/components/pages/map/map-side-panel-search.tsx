import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMapHighlightContext, useMapSearchContext } from '../../../context/map.ts';
import { MapSearchResults } from './map-search-results.tsx';
import { useMapSearchFilterViews } from '../../../hooks/map.js';
import { MapSidePanelContainer } from './map-side-panel-container.tsx';

const useSearchResults = (allowedViewIds: Set<string>) => {
    const { entityFilteredResults } = useMapSearchContext();
    return useMemo(() => {
        if (!entityFilteredResults) {
            return [];
        }

        if (allowedViewIds.size === 0) {
            return entityFilteredResults;
        }

        return entityFilteredResults.filter(result => {
            return (result.cafeId && allowedViewIds.has(result.cafeId))
                || Array.from(result.locationDatesByCafeId.keys()).some(cafeId => allowedViewIds.has(cafeId));
        });
    }, [entityFilteredResults, allowedViewIds]);
}

export const MapSidePanelSearch = () => {
    const navigate = useNavigate();
    const { setHighlightedCafeIds, setSelectedSearchResult } = useMapHighlightContext();
    const { filterViewName, isFilteringViews, allowedViewIds, isFilteredToHomeCafes, onFilterToHomeCafes, onClearFilteredViews } = useMapSearchFilterViews();
    const searchResults = useSearchResults(allowedViewIds);
    const { query } = useMapSearchContext();

    const onClearSearch = () => {
        navigate('/map');
        setHighlightedCafeIds(new Set());
        setSelectedSearchResult(null);
    };

    const onCloseButtonClicked = () => {
        if (isFilteringViews) {
            onClearFilteredViews();
        } else {
            onClearSearch();
        }
    }

    const closeButtonText = isFilteredToHomeCafes ? 'Back to all results' : 'Clear search';
    const closeButtonIcon = isFilteredToHomeCafes ? 'arrow_back' : 'close';

    return (
        <MapSidePanelContainer>
            <div className="panel-header flex">
                <span className="material-symbols-outlined">map</span>
                <span className="panel-title">
                    {filterViewName || `Search results for "${query}"`}
                </span>
                <button
                    onClick={onCloseButtonClicked}
                    className="default-button default-container icon-container"
                    title={closeButtonText}
                >
                    <span className="material-symbols-outlined">{closeButtonIcon}</span>
                </button>
            </div>
            <MapSearchResults
                results={searchResults}
                isFilteredToHomeCafes={isFilteredToHomeCafes}
                onFilterToHomeCafes={onFilterToHomeCafes}
            />
        </MapSidePanelContainer>
    );
};
