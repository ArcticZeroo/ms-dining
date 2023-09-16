import { BooleanSetting } from '../../../api/settings.ts';
import { ISettingsContext, SettingsContext } from '../../../context/settings.ts';
import React, { useContext } from 'react';

interface IBooleanSettingInputProps {
    name: React.ReactElement;
    description?: React.ReactElement;
    setting: BooleanSetting;
    contextKey: keyof ISettingsContext;
}

export const BooleanSettingInput: React.FC<IBooleanSettingInputProps> = ({ name, description, setting, contextKey }) => {
    const [settingsData, setSettingsData] = useContext(SettingsContext);
    const currentValue = settingsData[contextKey];

    if (typeof currentValue !== 'boolean') {
        return (
            <div className="error-card">
                Could not load setting {name}!
            </div>
        );
    }

    const toggleSetting = () => {
        const newValue = !currentValue;

        setSettingsData({
            ...settingsData,
            [contextKey]: newValue
        });

        setting.set(newValue);
    }

    const htmlId = `setting-${contextKey}`;

    return (
        <div className="setting">
            <label htmlFor={htmlId} className="setting-info">
                <div className="setting-name">
                    {name}
                </div>
                {
                    description && (
                        <div className="setting-description">
                            {description}
                        </div>
                    )
                }
            </label>
            <input type="checkbox"
                   id={htmlId}
                   checked={currentValue}
                   onChange={toggleSetting}/>
        </div>
    );
};