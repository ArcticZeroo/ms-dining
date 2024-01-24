import { ValueNotifier } from '../util/events.ts';

export interface ILocationCoordinates {
    latitude: number;
    longitude: number;
}

class GelocationProvider extends ValueNotifier<ILocationCoordinates | null> {
    private _watchId?: number;
    private _isFetchingInitialPosition: boolean = false;

    public constructor() {
        super(null);
    }


    private set value(value: ILocationCoordinates) {
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
        this.value = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
        };
    }

    private _ensureWatching() {
        if (this._watchId) {
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
        this._setupInitialPosition();
        this._ensureWatching();
    }

    removeListener(listener: (value: ILocationCoordinates | null, oldValue: ILocationCoordinates | null) => void) {
        super.removeListener(listener);

        if (this._listeners.length === 0) {
            this._stopWatching();
        }
    }
}

export const UserLocationNotifier = new GelocationProvider();