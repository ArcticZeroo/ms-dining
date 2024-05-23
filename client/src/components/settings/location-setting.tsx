import { BooleanSettingInput } from './boolean-setting-input.tsx';
import { LocationPermissionStatus } from './location-permission-status.tsx';
import { ApplicationSettings } from '../../constants/settings.ts';

export const LocationSetting = () => (
    <BooleanSettingInput
        icon="location_on"
        setting={ApplicationSettings.allowLocation}
        name="Allow Location"
        description={
            <>
                <p>
                    When enabled, your location may be retrieved for more intelligent features, such as ranking
                    search results based on how close they are to you, and suggesting nearby cafes.
                    <br/>
                    Your location data will never be sent to the server.
                </p>
                <LocationPermissionStatus/>
            </>
        }
    />
);