import React from "react";

import './checkbox-dropdown.css';

export interface IDropdownOption {
    text: string;
    id: string;
}

interface ICheckboxDropdownProps {
    id: string;
    options: IDropdownOption[];
    selectedOptions: Set<string>;
    buttons?: React.ReactNode;

    onSelectedOptionsChanged(selectedOptions: Set<string>): void;
}

const CheckboxDropdownWithRef: React.ForwardRefRenderFunction<HTMLDivElement, ICheckboxDropdownProps> = ({
    id,
    options,
    selectedOptions,
    onSelectedOptionsChanged,
    buttons
}, ref) => {
    const onCheckboxChanged = (event: React.ChangeEvent<HTMLInputElement>, id: string) => {
        const newSelectedOptions = new Set(selectedOptions);
        if (event.target.checked) {
            newSelectedOptions.add(id);
        } else {
            newSelectedOptions.delete(id);
        }

        onSelectedOptionsChanged(newSelectedOptions);
    }

    const onSelectAll = () => {
        const newSelectedOptions = new Set(options.map(option => option.id));
        onSelectedOptionsChanged(newSelectedOptions);
    }

    const onClearAll = () => {
        onSelectedOptionsChanged(new Set());
    }

    return (
        <div className="dropdown default-container flex-col" ref={ref}>
            <div className="relative">
                <div className="flex flex-around buttons">
                    { buttons }
                    <button onClick={onSelectAll} className="default-container shrink-padding">
                        Select All
                    </button>
                    <button onClick={onClearAll} className="default-container shrink-padding">
                        Clear All
                    </button>
                </div>
                <div>
                    {
                        options.map(option => (
                            <label
                                key={option.id}
                                className="option flex flex-between"
                                htmlFor={`${id}-${option.id}`}
                            >
                                <span>
                                    {option.text}
                                </span>
                                <input
                                    id={`${id}-${option.id}`}
                                    value={option.id}
                                    type="checkbox"
                                    checked={selectedOptions.has(option.id)}
                                    onChange={event => onCheckboxChanged(event, option.id)}
                                />
                            </label>
                        ))
                    }
                </div>
            </div>
        </div>
    );
}

export const CheckboxDropdown = React.forwardRef(CheckboxDropdownWithRef);