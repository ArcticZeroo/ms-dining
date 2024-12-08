import { useValueNotifier } from "../../hooks/events.ts";
import { PassiveUserLocationNotifier } from "../../api/location/user-location.ts";
import { CircleMarker } from "react-leaflet";
import { toLeafletLocation } from "../../util/coordinates.ts";

export const CampusMapUserLocation = () => {
    const userLocation = useValueNotifier(PassiveUserLocationNotifier);

    if (userLocation == null) {
        return null;
    }

    return (
        <CircleMarker
            center={toLeafletLocation(userLocation)}
            pathOptions={{ fillColor: 'blue' }}
            radius={15}
        />
    );
}