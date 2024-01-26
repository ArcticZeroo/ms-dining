import { ILocationCoordinates } from '@msdining/common/dist/models/util';
import { ValueNotifier } from '../util/events.ts';
import { ApplicationSettings } from './settings.ts';

class UserLocationProvider extends ValueNotifier<ILocationCoordinates | null> {
    private _watchId?: number;
    private _isFetchingInitialPosition: boolean = false;

    public constructor() {
        super(null);

        ApplicationSettings.allowLocation.addListener(isAllowed => {
            if (isAllowed) {
                this._trySetupListeners();
            } else {
                this._stopWatching();
                this.value = null;
            }
        });
    }

    private set value(value: ILocationCoordinates | null) {
        super.value = value;
    }

    public get value(): ILocationCoordinates | null {
        return super.value;
    }

    private _setupInitialPosition() {
        if (this.value != null || this._isFetchingInitialPosition) {
            return;
        }

        this._isFetchingInitialPosition = true;

        navigator.geolocation.getCurrentPosition(
            position => {
                this._updatePosition(position);
                this._isFetchingInitialPosition = false;
            },
            (error) => {
                // TODO: Maybe retry?
                console.error('Could not get initial position:', error);
                this._isFetchingInitialPosition = false;
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
        if (this._listeners.length === 0 || !ApplicationSettings.allowLocation.value) {
            return;
        }

        this._setupInitialPosition();

        if (this._watchId != null) {
            return;
        }

        this._watchId = navigator.geolocation.watchPosition(
            position => this._updatePosition(position),
            (error) => console.error('Could not watch position:', error)
        );
    }

    private _stopWatching() {
        if (this._watchId) {
            navigator.geolocation.clearWatch(this._watchId);
        }
    }

    addListener(listener: (value: ILocationCoordinates | null, oldValue: ILocationCoordinates | null) => void) {
        super.addListener(listener);
        this._trySetupListeners();
    }

    removeListener(listener: (value: ILocationCoordinates | null, oldValue: ILocationCoordinates | null) => void) {
        super.removeListener(listener);

        if (this._listeners.length === 0) {
            this._stopWatching();
        }
    }
}

export const UserLocationNotifier = new UserLocationProvider();