import './boolean-switch.css';
import { classNames } from "../../util/react.ts";
import React, { useMemo } from "react";
import { randomString } from "../../util/random.ts";

interface IBooleanSwitchProps {
    disabled?: boolean;
    value: boolean;
    onChange: (value: boolean) => void;
}

export const BooleanSwitch = ({ disabled = false, value, onChange }: IBooleanSwitchProps) => {
    const id = useMemo(
        () => `boolean-switch-${randomString(8)}`,
        []
    );

    const onInputChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (disabled) {
            return;
        }

        onChange(event.target.checked);
    }

    return (
        <label
            className={classNames('flex relative boolean-switch', value && 'true', disabled && 'disabled')}
            htmlFor={id}
        >
            <input
                disabled={disabled}
                id={id}
                type="checkbox"
                checked={value}
                onChange={onInputChanged}
            />
            <div className="switch"/>
        </label>
    );
}