import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import { useMapPageOverviewSelectedView, useMapPageSelectedBuilding, useMapSearchFilterViews, useMarkerLabelModes } from '../../hooks/map.ts';
import { CafeView, CafeViewType } from '../../models/cafe.ts';
import { CafeMarker } from './popup/cafe-marker.tsx';
import { GenericMapView } from './generic-map-view.js';
import { ApplicationContext } from '../../context/app.ts';
import { getViewLocation } from '../../util/view.ts';
import { calculateCenter, toLeafletLocation } from '../../util/coordinates.ts';
import { BuildingOutlineLayer } from './building-outline-layer.tsx';
import { IBuildingOutline } from '@msdining/common/models/building';

const viewMatchesCafeIds = (view: CafeView, cafeIds: Set<string>): boolean => {
    if (cafeIds.has(view.value.id)) {
        return true;
    }

    if (view.type === CafeViewType.group) {
        return view.value.members.some(member => cafeIds.has(member.id));
    }

    return false;
};

const useMapFlyToBuilding = (building: IBuildingOutline | undefined) => {
    const map = useMap();

    useEffect(() => {
        if (!building) {
            return;
        }
        const target = toLeafletLocation(building.centroid);
        map.flyTo(target, 17, { duration: 0.5 });
    }, [building, map]);
};

const useMapFlyTo = (cafeIds?: Set<string>) => {
    const map = useMap();
    const { viewsById } = useContext(ApplicationContext);

    useEffect(() => {
        if (!cafeIds || cafeIds.size === 0) {
            return;
        }

        const locations = Array.from(cafeIds)
            .map(id => viewsById.get(id))
            .filter(Boolean)
            .map(view => getViewLocation(view!));

        if (locations.length === 0) {
            return;
        }

        const center = locations.length === 1
            ? locations[0]!
            : calculateCenter(locations);

        const target = toLeafletLocation(center);
        const current = map.getCenter();
        const distancePx = map.latLngToContainerPoint(target).distanceTo(map.latLngToContainerPoint(current));

        if (distancePx < 30) {
            return;
        }

        map.flyTo(target, map.getZoom(), { duration: 0.5 });
    }, [cafeIds, viewsById, map]);
};

interface IFullMapMarkersProps {
    onSelectView(view: CafeView, isMultiSelect: boolean): void;
    highlightedCafeIds?: Set<string>;
    searchResultCafeIds?: Set<string>;
    selectedCafeIds?: Set<string>;
}

const FullMapMarkers: React.FC<IFullMapMarkersProps> = ({ onSelectView, highlightedCafeIds, searchResultCafeIds, selectedCafeIds }) => {
    const { views, labelModes } = useMarkerLabelModes();
    const hasActiveSearch = searchResultCafeIds != null && searchResultCafeIds.size > 0;
    const { allowedViewIds } = useMapSearchFilterViews();
    const overviewSelectedView = useMapPageOverviewSelectedView();

    useMapFlyTo(selectedCafeIds);

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
    selectedCafeIds?: Set<string>;
}

// Can't do flyTo above the GenericMapView since we don't have map context yet.
// TODO: figure out a less hacky way to do this.
const BuildingFlyTo: React.FC<{ building: IBuildingOutline | undefined }> = ({ building }) => {
    useMapFlyToBuilding(building);
    return null;
};

const FullMapView: React.FC<IFullMapViewProps> = (props) => {
    const navigate = useNavigate();
    const selectedBuilding = useMapPageSelectedBuilding();
    const [hoveredBuildingName, setHoveredBuildingName] = useState<string | null>(null);

    const effectiveHighlightedBuilding = selectedBuilding?.name ?? hoveredBuildingName;

    const onBuildingClick = useCallback((building: IBuildingOutline) => {
        navigate(`/map/building/${encodeURIComponent(building.name)}`);
    }, [navigate]);

    const onBuildingHover = useCallback((building: IBuildingOutline | null) => {
        setHoveredBuildingName(building?.name ?? null);
    }, []);

    return (
        <GenericMapView isMapHeight={false}>
            <BuildingFlyTo building={selectedBuilding}/>
            <BuildingOutlineLayer
                highlightedBuildingName={effectiveHighlightedBuilding}
                onBuildingClick={onBuildingClick}
                onBuildingHover={onBuildingHover}
            />
            <FullMapMarkers {...props}/>
        </GenericMapView>
    );
};

export default FullMapView;