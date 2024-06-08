import { ILocationCoordinates } from '@msdining/common/dist/models/util.ts';
import { ValueNotifier } from '../../util/events.ts';
import Duration from '@arcticzeroo/duration';
import { ApplicationSettings } from '../../constants/settings.ts';
import { PermissionGrantedNotifier } from '../permission-notifier.ts';

const RETRIEVE_LOCATION_INTERVAL = new Duration({ minutes: 1 });

class UserLocationProvider extends ValueNotifier<ILocationCoordinates | null> {
    private _watchId?: number;
    private _interval?: ReturnType<typeof setInterval>;
    private _isFetchingCurrentLocation: boolean = false;
    private _isAllowedToRetrieveLocationNotifier: ValueNotifier<boolean>;

    public constructor(requirePermissionToBeGranted: boolean = false) {
        super(null);

        if (requirePermissionToBeGranted) {
            this._isAllowedToRetrieveLocationNotifier = new PermissionGrantedNotifier('geolocation');
        } else {
            this._isAllowedToRetrieveLocationNotifier = new ValueNotifier(true);
        }

        ApplicationSettings.allowLocation.addListener(isAllowed => {
            if (isAllowed) {
                this._trySetupListeners();
            } else {
                this._stopWatching();
                this.value = null;
            }
        });

        this._isAllowedToRetrieveLocationNotifier.addListener(isGranted => {
            if (isGranted) {
                this._trySetupListeners();
            }
        });
    }

    private set value(value: ILocationCoordinates | null) {
        super.value = value;
    }

    public get value(): ILocationCoordinates | null {
        return super.value;
    }

    private _retrieveCurrentLocation() {
        if (this._isFetchingCurrentLocation) {
            return;
        }

        this._isFetchingCurrentLocation = true;

        navigator.geolocation.getCurrentPosition(
            position => {
                this._updatePosition(position);
                this._isFetchingCurrentLocation = false;
            },
            (error) => {
                // TODO: Maybe retry?
                console.error('Could not get initial position:', error);
                this._isFetchingCurrentLocation = false;
            }
        );
    }

    private _updatePosition(position: GeolocationPosition) {
        if (position.coords.latitude === 0 && position.coords.longitude === 0) {
            return;
        }

        this.value = {
            lat: position.coords.latitude,
            long: position.coords.longitude
        };
    }

    private _trySetupListeners() {
        if (!this._isAllowedToRetrieveLocationNotifier.value) {
            return;
        }

        if (this._listeners.size === 0 || !ApplicationSettings.allowLocation.value) {
            return;
        }

        this._retrieveCurrentLocation();

        if (this._watchId != null) {
            return;
        }

        this._watchId = navigator.geolocation.watchPosition(
            position => this._updatePosition(position),
            (error) => console.error('Could not watch position:', error)
        );

        this._interval = setInterval(
            () => this._retrieveCurrentLocation(),
            RETRIEVE_LOCATION_INTERVAL.inMilliseconds
        );
    }

    private _stopWatching() {
        if (this._watchId != null) {
            navigator.geolocation.clearWatch(this._watchId);
        }

        if (this._interval != null) {
            clearInterval(this._interval);
        }
    }

    addListener(listener: (value: ILocationCoordinates | null, oldValue: ILocationCoordinates | null) => void) {
        const wasAdded = super.addListener(listener);
        this._trySetupListeners();
        return wasAdded;
    }

    removeListener(listener: (value: ILocationCoordinates | null, oldValue: ILocationCoordinates | null) => void) {
        const wasRemoved = super.removeListener(listener);

        if (wasRemoved && this._listeners.size === 0) {
            this._stopWatching();
        }

        return wasRemoved;
    }
}

export const PromptingUserLocationNotifier = new UserLocationProvider();
export const PassiveUserLocationNotifier = new UserLocationProvider(true /*requirePermissionToBeGranted*/);

export const queryForLocationPermission = () => {
    navigator.geolocation.getCurrentPosition(
        () => null,
        () => null
    );
}