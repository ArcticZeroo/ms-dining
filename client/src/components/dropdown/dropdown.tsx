import React, { useEffect } from "react";
import { hasAncestor } from "../../util/html.ts";

interface IDropdownProps {
    onClose(): void;
    children: React.ReactNode;
}

export const Dropdown: React.FC<IDropdownProps> = ({ onClose, children }) => {
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    useEffect(
        () => {
            const closeDropdown = (event: MouseEvent) => {
                const dropdown = dropdownRef.current;
                const target = event.target as HTMLElement;

                if (hasAncestor(target, dropdown)) {
                    return;
                }

                event.stopPropagation();
                onClose();
            };

            window.addEventListener('click', closeDropdown);

            return () => {
                window.removeEventListener('click', closeDropdown);
            };
        },
        [onClose]
    );

    return (
        <div className="dropdown default-container flex-col" ref={dropdownRef}>
            {children}
        </div>
    );
}