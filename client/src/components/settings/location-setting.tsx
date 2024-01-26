import { BooleanSettingInput } from './boolean-setting-input.tsx';
import { ApplicationSettings } from '../../api/settings.ts';

export const LocationSetting = () => (
    <BooleanSettingInput
        icon="location_on"
        setting={ApplicationSettings.allowLocation}
        name="Allow Location"
        description={
            <>
                When enabled, your location will be retrieved for more intelligent features.
                <br/>
                Your location data will never be sent to the server.
            </>
        }
    />
);