import { classNames } from "../../../util/react.ts";

interface IVolumeTypeButtonProps {
    type: string;
    selected: boolean;
    onClick: () => void;
    disabled?: boolean;
}

export const VolumeTypeButton = ({ type, selected, onClick, disabled = false }: IVolumeTypeButtonProps) => (
    <button
        className={classNames('default-container transition-background', selected && 'selected', disabled && 'disabled')}
        onClick={disabled ? undefined : onClick}
    >
        {type}
    </button>
);