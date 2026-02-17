import React, { useEffect, useMemo, useState } from 'react';
import { ValueNotifier } from '../../util/events.ts';
import { classNames } from '../../util/react.ts';
import { DebugSettings } from '../../constants/settings.ts';
import { useIsAdmin } from '../../hooks/auth.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { BooleanSetting } from '../../api/settings.ts';

const ALLOWED_SETTINGS = Object.values(DebugSettings);

const SETTING_DISPLAY_NAMES: Record<string, string> = {
    [DebugSettings.allowOnlineOrdering.name]:                      'Allow Online Ordering',
    [DebugSettings.suppressExperimentalOnlineOrderingWarning.name]: 'Suppress Online Ordering Warning',
    [DebugSettings.verboseLogging.name]:                           'Verbose Logging',
    [DebugSettings.noVectorSearch.name]:                           'Disable Vector Search',
    [DebugSettings.ingredientsMenuExperience.name]:                'in.gredients 3-Course Menu',
};

const useIsKeyEnabled = (valueNotifier: ValueNotifier<boolean> | null) => {
    const [value, setValue] = useState<boolean>(false);

    useEffect(() => {
        if (valueNotifier == null) {
            return;
        }

        setValue(valueNotifier.value);

        const onChange = () => setValue(valueNotifier.value);
        valueNotifier.addListener(onChange);

        return () => {
            valueNotifier.addListener(onChange);
        };
    }, [valueNotifier]);

    return value;
}

interface IDebugSettingToggleProps {
    setting: BooleanSetting;
}

const DebugSettingToggle: React.FC<IDebugSettingToggleProps> = ({ setting }) => {
    const currentValue = useValueNotifier(setting) === true;
    const displayName = SETTING_DISPLAY_NAMES[setting.name] ?? setting.name;
    const htmlId = `debug-setting-${setting.name}`;

    return (
        <label htmlFor={htmlId} className="setting boolean-setting">
            <div className="setting-info">
                <div className="setting-name">
                    <span className="material-symbols-outlined">science</span>
                    {displayName}
                </div>
            </div>
            <input
                type="checkbox"
                id={htmlId}
                checked={currentValue}
                onChange={() => { setting.value = !currentValue; }}
            />
        </label>
    );
};

export const CustomKeySetting: React.FC = () => {
    const isAdmin = useIsAdmin();
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
                    {!isAdmin && (
                        <>
                            <br/>
                            If the setting does not exist, nothing will happen.
                        </>
                    )}
                </div>
            </div>
            {isAdmin && (
                <div className="flex-col" style={{ gap: 'var(--constant-mini-padding)' }}>
                    {ALLOWED_SETTINGS.map(setting => (
                        <DebugSettingToggle key={setting.name} setting={setting}/>
                    ))}
                </div>
            )}
            <div className="setting-input">
                <input type="text"
                    placeholder="Setting Key"
                    value={key}
                    onChange={event => setKey(event.target.value)}
                />
                <label htmlFor="custom-key-should-enable" id="custom-key-checkbox"
                    className={classNames(!isKeyValid && 'disabled')}>
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