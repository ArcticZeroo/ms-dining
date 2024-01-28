import { BooleanSettingInput } from './boolean-setting-input.tsx';
import { ApplicationSettings } from '../../api/settings.ts';
import { LocationPermissionStatus } from './location-permission-status.tsx';

export const LocationSetting = () => (
    <BooleanSettingInput
        icon="location_on"
        setting={ApplicationSettings.allowLocation}
        name="Allow Location"
        description={
            <>
                <p>
                    When enabled, your location will be retrieved for more intelligent features, such as ranking
                    search results based on how close they are to you.
                    <br/>
                    Your location data will never be sent to the server.
                </p>
                <LocationPermissionStatus/>
            </>
        }
    />
);