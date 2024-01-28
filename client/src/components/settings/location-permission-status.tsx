import { useHasPermissionBeenGranted } from '../../hooks/permission.ts';

export const LocationPermissionStatus = () => {
    const isLocationPermissionGranted = useHasPermissionBeenGranted('geolocation');

    return (
        <div className="flex">
            <span>
                Location Permission Status:
            </span>
            <span style={{ color: isLocationPermissionGranted ? 'green' : 'red' }}>
                {isLocationPermissionGranted ? 'Granted' : 'Not Granted'}
            </span>
        </div>
    );
}