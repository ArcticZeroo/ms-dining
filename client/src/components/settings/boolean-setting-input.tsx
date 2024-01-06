import { BooleanSetting } from '../../api/settings.ts';
import React from 'react';
import { useValueNotifier } from '../../hooks/events.ts';

interface IBooleanSettingInputProps {
    icon?: string;
    name: React.ReactElement | string;
    description?: React.ReactElement | string;
    setting: BooleanSetting;
    requiredSettings?: Array<BooleanSetting>;
    isChip?: boolean;
}

export const BooleanSettingInput: React.FC<IBooleanSettingInputProps> = ({
    icon,
    name,
    description,
    setting,
    isChip = false
}) => {
    const currentValue = useValueNotifier(setting);

    const toggleSetting = () => {
        setting.value = !currentValue;
    };

    const htmlId = `setting-${setting.name}`;

    const iconComponent = icon && (
        <span className="material-symbols-outlined">
            {icon}
        </span>
    );

    const inputComponent = (
        <input type="checkbox"
            id={htmlId}
            checked={currentValue}
            onChange={toggleSetting}/>
    );

    if (isChip) {
        return (
            <label htmlFor={htmlId} className="setting-chip">
                {iconComponent}
                {name}
                {inputComponent}
            </label>
        );

    }

    return (
        <label htmlFor={htmlId} className="setting boolean-setting">
            <div className="setting-info">
                <div className="setting-name">
                    {iconComponent}
                    {name}
                </div>
                {
                    description && (
                        <div className="setting-description">
                            {description}
                        </div>
                    )
                }
            </div>
            {inputComponent}
        </label>
    );
};