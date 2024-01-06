import { BooleanSetting, NumberSetting } from '../../api/settings.ts';
import React, { useMemo } from 'react';
import { useValueNotifierAsState } from '../../hooks/events.ts';
import { useAreRequiredSettingsEnabled } from '../../hooks/settings.ts';
import { classNames } from '../../util/react.ts';

interface INumberSettingInputProps {
    name: string;
    setting: NumberSetting;
    requiredSettings?: BooleanSetting[];
    min?: number;
    max?: number;
    step?: number;
}

export const NumberSettingInput: React.FC<INumberSettingInputProps> = ({
    name,
    setting,
    requiredSettings = [],
    min = 0,
    max,
    step
}) => {
    const [value, setValue] = useValueNotifierAsState(setting);

    const areRequiredSettingsEnabled = useAreRequiredSettingsEnabled(requiredSettings);
    const isAtLimit = value === min || (max != null && value === max);

    const onValueChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newValueRaw = event.target.value;
        const newValue = Number(newValueRaw);

        if (Number.isNaN(newValue)) {
            return;
        }

        if (newValue < min) {
            return;
        }

        if (max != null && newValue > max) {
            return;
        }

        setValue(newValue);
    };

    const title = useMemo(() => {
        if (value === min) {
            return 'Can\'t go any lower!';
        }

        if (max != null && value === max) {
            return 'Can\'t go any higher!';
        }
    }, [value, min, max]);

    return (
        <label
            className={classNames(
                'setting-input setting-chip number-setting',
                !areRequiredSettingsEnabled && 'disabled',
                isAtLimit && 'at-limit'
            )}
            title={title}
        >
            <span className="setting-name">
                {name}
            </span>
            <input
                type="number"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={onValueChange}
                disabled={!areRequiredSettingsEnabled}
            />
        </label>
    );
}