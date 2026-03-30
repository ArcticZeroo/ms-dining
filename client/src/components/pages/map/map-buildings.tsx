import { BuildingOutlineLayer } from '../../map/building-outline-layer.js';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMapPageSelectedBuilding } from '../../../hooks/map.js';
import { IBuildingInfo } from '@msdining/common/models/building';
import { useMap } from 'react-leaflet';
import { toLeafletLocation } from '../../../util/coordinates.js';

const useMapFlyToBuilding = (building: IBuildingInfo | undefined) => {
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

    const onBuildingClick = useCallback((building: IBuildingInfo) => {
        navigate(`/map/building/${encodeURIComponent(building.name)}`);
    }, [navigate]);

    const onBuildingHover = useCallback((building: IBuildingInfo | null) => {
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