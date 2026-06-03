import { useValueNotifier } from '../../hooks/events.ts';
import { PassiveUserLocationNotifier } from '../../api/location/user-location.ts';
import { Marker } from 'react-leaflet';
import { toLeafletLocation } from '../../util/coordinates.ts';
import leaflet from 'leaflet';

const USER_LOCATION_ICON = leaflet.divIcon({
    html:      '<span style="font-size: 1.5rem; filter: drop-shadow(0 1px 3px rgba(0,0,0,0.7));">📍</span>',
    className: '',
    iconSize:  [24, 24],
    iconAnchor: [12, 22],
});

export const CampusMapUserLocation = () => {
    const userLocation = useValueNotifier(PassiveUserLocationNotifier);

    if (userLocation == null) {
        return null;
    }

    return (
        <Marker
            position={toLeafletLocation(userLocation)}
            icon={USER_LOCATION_ICON}
        />
    );
}