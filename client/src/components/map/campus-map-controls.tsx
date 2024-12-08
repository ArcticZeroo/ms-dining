import { useMap } from "react-leaflet";
import React from "react";
import { ILeafletLocation, toLeafletLocation } from "../../util/coordinates.ts";
import { DEFAULT_MAP_ZOOM } from "../../constants/map.ts";
import { useValueNotifier } from "../../hooks/events.ts";
import { PassiveUserLocationNotifier } from "../../api/location/user-location.ts";

interface ICampusMapControls {
    center: ILeafletLocation;
}

export const CampusMapControls: React.FC<ICampusMapControls> = ({ center }) => {
    const map = useMap();
    const userLocation = useValueNotifier(PassiveUserLocationNotifier);

    const onHomeMapClicked = () => {
        map.setView(center, DEFAULT_MAP_ZOOM);
    };

    const onMoveToMyLocationClicked = () => {
        if (userLocation == null) {
            return;
        }

        map.setView(toLeafletLocation(userLocation), DEFAULT_MAP_ZOOM);
    }

    return (
        <div className="flex flex-col controls">
            <button 
                onClick={onHomeMapClicked} 
                className="icon-container default-container"
                title="Click to recenter map to the initial position">
                <span className="material-symbols-outlined icon-sized">
                    home
                </span>
            </button>
            {
                userLocation != null && (
                    <button
                        onClick={onMoveToMyLocationClicked}
                        className="icon-container default-container"
                        title="Click to recenter map to your location">
                        <span className="material-symbols-outlined icon-sized">
                            my_location
                        </span>
                    </button>
                )
            }
        </div>
    );
}