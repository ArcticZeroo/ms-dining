import { PassiveUserLocationNotifier, queryForLocationPermission } from '../../api/location/user-location.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import React from 'react';

interface ILocationAllowButtonProps {
	reason?: string;
}

export const LocationAllowButton: React.FC<ILocationAllowButtonProps> = ({ reason }) => {
    const userLocation = useValueNotifier(PassiveUserLocationNotifier);

    if (userLocation != null) {
        return null;
    }

    return (
        <button className="default-container flex flex-center" onClick={queryForLocationPermission}>
            <span className="material-symbols-outlined">
			   location_on
            </span>
			Allow location permissions {reason || 'for improved personalization'}
        </button>
    );
}