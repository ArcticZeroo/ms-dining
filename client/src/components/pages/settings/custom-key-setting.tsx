import { ApplicationSettings, BooleanSetting } from '../../../api/settings.ts';
import React, { useState } from 'react';

const ALLOWED_SETTINGS: BooleanSetting[] = [
    ApplicationSettings.allowOnlineOrdering
];

export const CustomKeySetting: React.FC = () => {
    const [key, setKey] = useState<string>('');
    const [shouldEnableKey, setShouldEnableKey] = useState(false);

    const onSave = () => {
        for (const allowedSetting of ALLOWED_SETTINGS) {
            if (allowedSetting.name === key) {
                allowedSetting.value = shouldEnableKey;
                return;
            }
        }
    };

    return (
        <div className="setting" id="setting-custom">
            <div className="setting-info">
                <div className="setting-name">
                    Experimental Custom Settings
                </div>
                <div className="setting-description">
                    Change custom settings that are not available in the settings menu.
                    <br/>
                    These are here for testing purposes only.
                    <br/>
                    If the setting does not exist, nothing will happen.
                </div>
            </div>
            <div className="setting-input">
                <input type="text"
                       placeholder="Setting Key"
                       value={key}
                       onChange={event => setKey(event.target.value)}
                />
                <label htmlFor="custom-key-should-enable" id="custom-key-checkbox">
                    Enable Key
                    <input type="checkbox"
                           id="custom-key-should-enable"
                           checked={shouldEnableKey}
                           onChange={event => setShouldEnableKey(event.target.checked)}
                    />
                </label>
                <button onClick={onSave}>
                    {shouldEnableKey ? 'Enable Setting' : 'Disable Setting'}
                </button>
            </div>
        </div>
    );
}