import { BooleanSetting, NumberSetting } from '../../api/settings.ts';
import React, { useEffect, useMemo, useState } from 'react';
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
    // We don't want to directly use the value notifier because it's really annoying when a website doesn't let a user
    // directly edit a number input (e.g. you have 10 in the box, you want to write 11, but the min is 5 so when you 
    // delete the zero it just returns). So, instead we will hold a string and only write to the value when it's valid.
    const [valueRaw, setValueRaw] = useState<string>(() => setting.value.toString());

    const isValid = useMemo(
        () => {
            const value = Number(valueRaw);

            return !Number.isNaN(value)
                && value >= min
                && (max == null || value <= max);
        },
        [max, min, valueRaw]
    );

    const areRequiredSettingsEnabled = useAreRequiredSettingsEnabled(requiredSettings);
    const isAtLimit = useMemo(
        () => {
            if (!isValid) {
                return false;
            }
            
            const value = Number(valueRaw);

            return value === min || (max != null && value === max);
        },
        [isValid, valueRaw, min, max]
    );

    useEffect(() => {
        if (isValid) {
            setting.value = Number(valueRaw);
        }
    }, [isValid, setting, valueRaw]);

    const onValueChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newValueRaw = event.target.value;
        setValueRaw(newValueRaw);
    };

    const title = useMemo(() => {
        const value = Number(valueRaw);

        if (Number.isNaN(value)) {
            return 'Invalid number!';
        }
        
        if (value === min) {
            return 'Can\'t go any lower!';
        }

        if (value < min) {
            return `Must be at least ${min}!`;
        }

        if (max != null && value === max) {
            return 'Can\'t go any higher!';
        }

        if (max != null && value > max) {
            return `Must be at most ${max}!`;
        }
    }, [valueRaw, min, max]);

    return (
        <label
            className={classNames(
                'setting-input setting-chip number-setting self-stretch',
                !areRequiredSettingsEnabled && 'disabled',
                isAtLimit && 'at-limit',
                !isValid && 'invalid'
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
                value={valueRaw}
                onChange={onValueChange}
                disabled={!areRequiredSettingsEnabled}
            />
        </label>
    );
}