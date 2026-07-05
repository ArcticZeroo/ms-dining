import React from 'react';
import { DebugSettings } from '../../constants/settings.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { BooleanSetting } from '../../api/settings.ts';

const SETTING_DISPLAY_NAMES: Record<string, string> = {
    [DebugSettings.allowOnlineOrdering.name]:                       'Allow Online Ordering',
    [DebugSettings.forceAllowOnlineOrdering.name]:                  'Force Allow Online Ordering',
    [DebugSettings.suppressExperimentalOnlineOrderingWarning.name]: 'Suppress Online Ordering Warning',
    [DebugSettings.verboseLogging.name]:                            'Verbose Logging',
    [DebugSettings.noVectorSearch.name]:                            'Disable Vector Search',
    [DebugSettings.ingredientsMenuExperience.name]:                 'in.gredients 3-Course Menu',
    [DebugSettings.enableMapPageSearch.name]:                       'Enable Map Page Search',

    [DebugSettings.showAdminReviewControls.name]: 'Show Admin Review Controls',
    [DebugSettings.showCafeHours.name]:           'Show Cafe Hours',
};

interface IDebugSettingToggleProps {
    setting: BooleanSetting;
}

export const DebugSettingToggle: React.FC<IDebugSettingToggleProps> = ({ setting }) => {
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
                onChange={() => {
                    setting.value = !currentValue;
                }}
            />
        </label>
    );
};
