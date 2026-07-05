import React from 'react';
import { classNames } from "../../../util/react.ts";

interface IVolumeTypeButtonProps {
    type: string;
    selected: boolean;
    onClick: () => void;
    disabled?: boolean;
}

export const VolumeTypeButton: React.FC<IVolumeTypeButtonProps> = ({ type, selected, onClick, disabled = false }) => (
    <button
        className={classNames('default-container transition-background', selected && 'selected', disabled && 'disabled')}
        onClick={disabled ? undefined : onClick}
    >
        {type}
    </button>
);