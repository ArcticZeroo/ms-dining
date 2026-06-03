import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { GeoJSON, Marker, Tooltip, useMap } from 'react-leaflet';
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

const getFeatureStyle = (feature: GeoJSON.Feature | undefined, highlightedName: string | null, uniformStyle: boolean): leaflet.PathOptions => {
    if (!feature) {
        return NON_CAFE_STYLE;
    }

    if (feature.properties?.name === highlightedName) {
        return HIGHLIGHT_STYLE;
    }

    if (uniformStyle) {
        return NON_CAFE_STYLE;
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

// Average centroid of all buildings — used as the campus marker position
const CAMPUS_CENTROID = (() => {
    const buildings = MICROSOFT_BUILDINGS;
    const lat = buildings.reduce((sum, b) => sum + b.centroid.lat, 0) / buildings.length;
    const lng = buildings.reduce((sum, b) => sum + b.centroid.long, 0) / buildings.length;
    return { lat, lng };
})();

const CAMPUS_MARKER_ICON = leaflet.divIcon({
    html:      '<span style="font-size: 1.5rem; filter: drop-shadow(0 1px 3px rgba(0,0,0,0.7));">💼</span>',
    className: '',
    iconSize:  [24, 24],
    iconAnchor: [12, 12],
});

interface IBuildingOutlineLayerProps {
    highlightedBuildingName: string | null;
    onBuildingClick(building: IBuildingInfo): void;
    onBuildingHover(building: IBuildingInfo | null): void;
    /** When true, all buildings render with the same style (no cafe highlight) and all are interactive. */
    uniformStyle?: boolean;
    /** When true, shows a campus marker at low zoom levels. */
    showCampusMarker?: boolean;
}

export const BuildingOutlineLayer: React.FC<IBuildingOutlineLayerProps> = ({
    highlightedBuildingName,
    onBuildingClick,
    onBuildingHover,
    uniformStyle = false,
    showCampusMarker = false,
}) => {
    const map = useMap();
    const geoJsonRef = useRef<leaflet.GeoJSON | null>(null);

    const [zoom, setZoom] = React.useState(() => map.getZoom());

    useEffect(() => {
        const onZoom = () => setZoom(map.getZoom());
        map.on('zoomend', onZoom);
        return () => {
            map.off('zoomend', onZoom); 
        };
    }, [map]);

    const isOutlineVisible = zoom >= BUILDING_OUTLINE_MIN_ZOOM;
    const isCampusMarkerVisible = showCampusMarker && !isOutlineVisible;

    // Re-apply styles when highlight changes (without remounting the GeoJSON layer)
    useEffect(() => {
        if (!geoJsonRef.current) {
            return;
        }
        geoJsonRef.current.setStyle((feature) =>
            getFeatureStyle(feature as GeoJSON.Feature | undefined, highlightedBuildingName, uniformStyle)
        );
    }, [highlightedBuildingName, uniformStyle]);

    const style = useCallback(
        (feature?: GeoJSON.Feature) => getFeatureStyle(feature, highlightedBuildingName, uniformStyle),
        [highlightedBuildingName, uniformStyle]
    );

    const onEachFeature = useCallback(
        (feature: GeoJSON.Feature, layer: leaflet.Layer) => {
            const building = BUILDINGS_BY_NAME.get(feature.properties?.name);
            if (!building) {
                return;
            }

            if (!uniformStyle && building.cafeId) {
                // In cafe mode, disable pointer cursor for cafe buildings (they use their own markers)
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
        [onBuildingClick, onBuildingHover, uniformStyle]
    );

    // Remount GeoJSON when uniformStyle changes so onEachFeature re-runs
    const geoJsonKey = useMemo(() => (uniformStyle ? 'uniform' : 'cafe'), [uniformStyle]);

    const onCampusMarkerClick = useCallback(() => {
        map.flyTo(CAMPUS_CENTROID, BUILDING_OUTLINE_MIN_ZOOM, { duration: 0.5 });
    }, [map]);

    return (
        <>
            {isCampusMarkerVisible && (
                <Marker
                    position={CAMPUS_CENTROID}
                    icon={CAMPUS_MARKER_ICON}
                    eventHandlers={{ click: onCampusMarkerClick }}
                >
                    <Tooltip direction="top">Microsoft Campus</Tooltip>
                </Marker>
            )}
            {isOutlineVisible && (
                <GeoJSON
                    key={geoJsonKey}
                    ref={geoJsonRef}
                    data={GEOJSON_DATA}
                    style={style}
                    onEachFeature={onEachFeature}
                />
            )}
        </>
    );
};
