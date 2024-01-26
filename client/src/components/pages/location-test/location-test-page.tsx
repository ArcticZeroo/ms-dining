import { useHasPermissionBeenGranted } from '../../../hooks/permission.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { UserLocationNotifier } from '../../../api/user-location.ts';
import { useContext, useMemo } from 'react';
import { ApplicationContext } from '../../../context/app.ts';
import { getCafeLocation } from '../../../util/cafe.ts';
import { getDistanceBetweenCoordinates } from '../../../util/user-location.ts';
import { LocationSetting } from '../../settings/location-setting.tsx';

export const LocationTestPage = () => {
    const isLocationPermissionGranted = useHasPermissionBeenGranted('geolocation');
    const userLocation = useValueNotifier(UserLocationNotifier);
    const { cafes } = useContext(ApplicationContext);

    const cafesInOrder = useMemo(
        () => {
            if (userLocation == null) {
                return [];
            }

            const cafesWithDistance = cafes.map(cafe => ({
                ...cafe,
                distance: getDistanceBetweenCoordinates(getCafeLocation(cafe), userLocation, true /*inMiles*/)
            }));

            return cafesWithDistance.sort((a, b) => a.distance - b.distance);
        },
        [cafes, userLocation]
    );

    return (
        <div className="flex-col">
            <div>Location Permission Granted: {isLocationPermissionGranted ? 'Yes' : 'No'}</div>
            <div className="card">
                <LocationSetting/>
            </div>
            {
                userLocation && (
                    <>
                        <div>User Location: {userLocation.lat}, {userLocation.long}</div>
                        <div className="flex-col">
                            Cafe Distances:
                            <div className="flex flex-wrap">
                                {
                                    cafesInOrder.map(cafe => (
                                        <div key={cafe.id} className="setting-chip" style={{ color: '#212121' }}>
                                            {cafe.name}: {cafe.distance.toFixed(1)} mi
                                        </div>
                                    ))
                                }
                            </div>
                        </div>
                    </>
                )
            }
        </div>
    );
}