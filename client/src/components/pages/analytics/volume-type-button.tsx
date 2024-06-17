import { classNames } from "../../../util/react.ts";

interface IVolumeTypeButtonProps {
    type: string;
    selected: boolean;
    onClick: () => void;
}

export const VolumeTypeButton = ({ type, selected, onClick }: IVolumeTypeButtonProps) => (
    <button
        className={classNames('default-container transition-background', selected && 'selected')}
        onClick={onClick}
    >
        {type}
    </button>
);