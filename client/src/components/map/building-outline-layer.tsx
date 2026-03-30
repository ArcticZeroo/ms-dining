import React, { useCallback, useEffect, useRef } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import leaflet from 'leaflet';
import { BUILDINGS_BY_NAME, MICROSOFT_BUILDINGS } from '@msdining/common/constants/buildings';
import { BUILDING_POLYGON_DATA } from '@msdining/common/constants/buildings-polygons.generated';
import { IBuildingInfo } from '@msdining/common/models/building';

const BUILDING_OUTLINE_MIN_ZOOM = 15;

const NON_CAFE_COLOR = '#888';
const CAFE_COLOR = '#4a90d9';
const HIGHLIGHT_COLOR = '#f0a050';

const NON_CAFE_STYLE: leaflet.PathOptions = {
    color:       NON_CAFE_COLOR,
    weight:      1.5,
    fillColor:   NON_CAFE_COLOR,
    fillOpacity: 0.45,
    opacity:     0.7,
};

const CAFE_STYLE: leaflet.PathOptions = {
    color:       CAFE_COLOR,
    weight:      1.5,
    fillColor:   CAFE_COLOR,
    fillOpacity: 0.5,
    opacity:     0.75,
};

const HIGHLIGHT_STYLE: leaflet.PathOptions = {
    color:       HIGHLIGHT_COLOR,
    weight:      3,
    fillColor:   HIGHLIGHT_COLOR,
    fillOpacity: 0.25,
    opacity:     0.9,
};

const getFeatureStyle = (feature: GeoJSON.Feature | undefined, highlightedName: string | null): leaflet.PathOptions => {
    if (!feature) {
        return NON_CAFE_STYLE;
    }

    if (feature.properties?.name === highlightedName) {
        return HIGHLIGHT_STYLE;
    }

    return feature.properties?.cafeId ? CAFE_STYLE : NON_CAFE_STYLE;
};

// Computed once at module level — the data is static
const GEOJSON_DATA: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: MICROSOFT_BUILDINGS.flatMap(building => {
        const polygon = BUILDING_POLYGON_DATA[building.name];
        if (polygon == null) {
            return [];
        }
        return [{
            type: 'Feature' as const,
            properties: { name: building.name, cafeId: building.cafeId },
            geometry: {
                type: 'Polygon' as const,
                coordinates: polygon,
            },
        }];
    }),
};

interface IBuildingOutlineLayerProps {
    highlightedBuildingName: string | null;
    onBuildingClick(building: IBuildingInfo): void;
    onBuildingHover(building: IBuildingInfo | null): void;
}

export const BuildingOutlineLayer: React.FC<IBuildingOutlineLayerProps> = ({ highlightedBuildingName, onBuildingClick, onBuildingHover }) => {
    const map = useMap();
    const geoJsonRef = useRef<leaflet.GeoJSON | null>(null);

    const [isVisible, setIsVisible] = React.useState(() => map.getZoom() >= BUILDING_OUTLINE_MIN_ZOOM);

    useEffect(() => {
        const onZoom = () => setIsVisible(map.getZoom() >= BUILDING_OUTLINE_MIN_ZOOM);
        map.on('zoomend', onZoom);
        return () => {
            map.off('zoomend', onZoom); 
        };
    }, [map]);

    // Re-apply styles when highlight changes (without remounting the GeoJSON layer)
    useEffect(() => {
        if (!geoJsonRef.current) {
            return;
        }
        geoJsonRef.current.setStyle((feature) =>
            getFeatureStyle(feature as GeoJSON.Feature | undefined, highlightedBuildingName)
        );
    }, [highlightedBuildingName]);

    const style = useCallback(
        (feature?: GeoJSON.Feature) => getFeatureStyle(feature, highlightedBuildingName),
        [highlightedBuildingName]
    );

    const onEachFeature = useCallback(
        (feature: GeoJSON.Feature, layer: leaflet.Layer) => {
            const building = BUILDINGS_BY_NAME.get(feature.properties?.name);
            if (!building || building.cafeId) {
                // Disable pointer cursor for cafe buildings (they use their own markers)
                if (layer instanceof leaflet.Path) {
                    layer.options.interactive = false;
                }
                return;
            }

            layer.bindTooltip(building.name, {
                sticky:    true,
                direction: 'top',
                className: 'building-tooltip',
            });

            layer.on({
                mouseover: () => onBuildingHover(building),
                mouseout:  () => onBuildingHover(null),
                click:     () => onBuildingClick(building),
            });
        },
        [onBuildingClick, onBuildingHover]
    );

    if (!isVisible) {
        return null;
    }

    return (
        <GeoJSON
            ref={geoJsonRef}
            data={GEOJSON_DATA}
            style={style}
            onEachFeature={onEachFeature}
        />
    );
};
