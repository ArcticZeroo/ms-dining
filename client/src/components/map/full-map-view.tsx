import React from 'react';
import { useMapPageOverviewSelectedView, useMapSearchFilterViews, useMarkerLabelModes } from '../../hooks/map.ts';
import { CafeView, CafeViewType } from '../../models/cafe.ts';
import { CafeMarker } from './popup/cafe-marker.tsx';
import { GenericMapView } from './generic-map-view.js';

const viewMatchesCafeIds = (view: CafeView, cafeIds: Set<string>): boolean => {
    if (cafeIds.has(view.value.id)) {
        return true;
    }

    if (view.type === CafeViewType.group) {
        return view.value.members.some(member => cafeIds.has(member.id));
    }

    return false;
};

interface IFullMapMarkersProps {
    onSelectView(view: CafeView, isMultiSelect: boolean): void;
    highlightedCafeIds?: Set<string>;
    searchResultCafeIds?: Set<string>;
}

const FullMapMarkers: React.FC<IFullMapMarkersProps> = ({ onSelectView, highlightedCafeIds, searchResultCafeIds }) => {
    const { views, labelModes } = useMarkerLabelModes();
    const hasActiveSearch = searchResultCafeIds != null && searchResultCafeIds.size > 0;
    const { allowedViewIds } = useMapSearchFilterViews();
    const overviewSelectedView = useMapPageOverviewSelectedView();

    return (
        <>
            {views.map(view => {
                if (hasActiveSearch && !viewMatchesCafeIds(view, searchResultCafeIds)) {
                    return null;
                }

                const isViewSelected = overviewSelectedView?.value.id === view.value.id || allowedViewIds.has(view.value.id);
                return (
                    <CafeMarker
                        key={view.value.id}
                        view={view}
                        onClick={onSelectView}
                        labelMode={labelModes.get(view.value.id) ?? 'none'}
                        isHighlighted={highlightedCafeIds != null && highlightedCafeIds.size > 0 && viewMatchesCafeIds(view, highlightedCafeIds)}
                        isSelected={isViewSelected && !hasActiveSearch}
                        isFilterSelected={isViewSelected && hasActiveSearch}
                        showTooltip
                    />
                );
            })}
        </>
    );
};

interface IFullMapViewProps {
    onSelectView(view: CafeView, isMultiSelect: boolean): void;
    highlightedCafeIds?: Set<string>;
    searchResultCafeIds?: Set<string>;
}

const FullMapView: React.FC<IFullMapViewProps> = (props) => {
    return (
        <GenericMapView isMapHeight={false}>
            <FullMapMarkers {...props}/>
        </GenericMapView>
    );
};

export default FullMapView;