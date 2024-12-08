import 'leaflet-defaulticon-compatibility';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet/dist/leaflet.css';

import { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { MapContainer, TileLayer } from 'react-leaflet';
import { InternalSettings } from '../../constants/settings.ts';
import { ApplicationContext } from '../../context/app.ts';
import { useVisibleViews } from '../../hooks/views.ts';
import { CafeView } from '../../models/cafe.ts';
import { calculateCenter, toLeafletLocation } from '../../util/coordinates.ts';
import { getViewLocation } from '../../util/view.ts';
import './map.css';
import { CafeMarker } from './popup/cafe-marker.tsx';
import { CampusMapPopup } from './popup/campus-map-popup.tsx';
import { CampusMapControls } from "./campus-map-controls.tsx";
import { DEFAULT_MAP_ZOOM } from "../../constants/map.ts";
import { CampusMapUserLocation } from "./campus-map-user-location.tsx";

// Intentionally not a hook, we don't want to change every time the user clicks on a new cafe
// (e.g. if the component is mounted on top of the cafe menu at some point in the future).
// Also views seems redundant here sine we have viewsById, but we don't want to weight the randomness
const getMapCenter = (views: CafeView[], viewsById: Map<string, CafeView>) => {
    const cafesInOrder = InternalSettings.lastUsedCafeIds.value;

    for (let i = cafesInOrder.length - 1; i >= 0; i--) {
        const id = cafesInOrder[i];
        const view = viewsById.get(id);
        if (view != null) {
            return getViewLocation(view);
        }
    }

    return calculateCenter(views.map(getViewLocation));
};

const CampusMapView = () => {
    // always use groups - single views would otherwise be stacked in one spot
    const views = useVisibleViews(true /*shouldUseGroups*/);
    const { viewsById } = useContext(ApplicationContext);
    const center = useMemo(
        () => toLeafletLocation(getMapCenter(views, viewsById)),
        [views, viewsById]
    );
    const [selectedView, setSelectedView] = useState<CafeView | null>(null);

    const onClose = useCallback(
        () => {
            // closeLeafletPopup();
            setSelectedView(null);
        },
        []
    );

    useEffect(() => {
        if (selectedView == null) {
            return;
        }

        const onEscapePressed = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                event.preventDefault();
                setSelectedView(null);
            }
        };

        document.addEventListener('keydown', onEscapePressed);

        return () => {
            document.removeEventListener('keydown', onEscapePressed);
        };
    }, [selectedView]);

    return (
        <div className="map-height campus-map-container">
            <MapContainer
                center={center}
                zoom={DEFAULT_MAP_ZOOM}
                scrollWheelZoom={true}
                className="campus-map"
            >
                <CampusMapUserLocation/>
                <CampusMapControls
                    center={center}
                />
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                {
                    views.map(view => (
                        <CafeMarker
                            key={view.value.id}
                            view={view}
                            onClick={setSelectedView}
                        />
                    ))
                }
            </MapContainer>
            {
                selectedView != null && (
                    <CampusMapPopup
                        view={selectedView}
                        onClose={onClose}
                    />
                )
            }
        </div>
    );
};

export default CampusMapView;