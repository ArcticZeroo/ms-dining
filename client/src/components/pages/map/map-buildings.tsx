import { BuildingOutlineLayer } from '../../map/building-outline-layer.js';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMapPageSelectedBuilding } from '../../../hooks/map.js';
import { IBuildingOutline } from '@msdining/common/dist/models/building.js';
import { useMap } from 'react-leaflet';
import { toLeafletLocation } from '../../../util/coordinates.js';

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

export const MapBuildings = () => {
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

    useMapFlyToBuilding(selectedBuilding);

    return (
        <BuildingOutlineLayer
            highlightedBuildingName={effectiveHighlightedBuilding}
            onBuildingClick={onBuildingClick}
            onBuildingHover={onBuildingHover}
        />
    );
}