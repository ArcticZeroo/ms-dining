import React, { useEffect, useMemo, useState } from 'react';
import { ApplicationSettings, BooleanSetting } from '../../api/settings.ts';
import { ValueNotifier } from '../../util/events.ts';
import { classNames } from '../../util/react.ts';

const ALLOWED_SETTINGS: BooleanSetting[] = [
    ApplicationSettings.allowOnlineOrdering,
    ApplicationSettings.suppressExperimentalOnlineOrderingWarning
];

const useIsKeyEnabled = (valueNotifier: ValueNotifier<boolean> | null) => {
    const [value, setValue] = useState<boolean>(false);

    useEffect(() => {
        if (valueNotifier == null) {
            return;
        }

        setValue(valueNotifier.value);

        const onChange = () => setValue(valueNotifier.value);
        valueNotifier.addListener(onChange);

        return () => valueNotifier.addListener(onChange);
    }, [valueNotifier]);

    return value;
}

export const CustomKeySetting: React.FC = () => {
    const [key, setKey] = useState<string>('');

    const selectedSetting = useMemo(() => {
        for (const allowedSetting of ALLOWED_SETTINGS) {
            if (allowedSetting.name === key) {
                return allowedSetting;
            }
        }

        return null;
    }, [key]);

    const isKeyValid = selectedSetting != null;
    const isKeyEnabled = useIsKeyEnabled(selectedSetting);

    const onChange = (value: boolean) => {
        if (selectedSetting == null) {
            return;
        }

        selectedSetting.value = value;
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
                <label htmlFor="custom-key-should-enable" id="custom-key-checkbox" className={classNames(!isKeyValid && 'disabled')}>
                    Enable Key
                    <input type="checkbox"
                        id="custom-key-should-enable"
                        checked={isKeyEnabled}
                        disabled={!isKeyValid}
                        onChange={event => onChange(event.target.checked)}
                    />
                </label>
            </div>
        </div>
    );
}