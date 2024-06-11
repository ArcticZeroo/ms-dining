import 'leaflet-defaulticon-compatibility';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet/dist/leaflet.css';

import { useContext, useMemo } from 'react';

import { MapContainer, TileLayer } from 'react-leaflet';
import { InternalSettings } from '../../constants/settings.ts';
import { ApplicationContext } from '../../context/app.ts';
import { useVisibleViews } from '../../hooks/views.ts';
import { CafeView } from '../../models/cafe.ts';
import { randomChoice } from '../../util/random.ts';
import { toLeafletLocation } from '../../util/user-location.ts';
import { getViewLocation } from '../../util/view.ts';
import { CafeMapMarker } from './cafe-map-marker.tsx';
import './map.css';

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

    // todo: get center of all views?
    return getViewLocation(randomChoice(views));
};

const CampusMapView = () => {
    // always use groups - single views would otherwise be stacked in one spot
    const views = useVisibleViews(true /*shouldUseGroups*/);
    const { viewsById } = useContext(ApplicationContext);
    const center = useMemo(
        () => toLeafletLocation(getMapCenter(views, viewsById)),
        [views, viewsById]
    );

    return (
        <MapContainer 
            center={center} 
            zoom={15} 
            scrollWheelZoom={true} 
            style={{ height: '50vh' }} 
            className="campus-map"
        >
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            {
                views.map(view => (
                    <CafeMapMarker view={view} key={view.value.id}/>
                ))
            }
        </MapContainer>
    );
};

export default CampusMapView;