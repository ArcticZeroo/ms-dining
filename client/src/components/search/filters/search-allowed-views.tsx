import { useViewsForNav } from "../../../hooks/views.ts";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { CheckboxDropdown } from "../../input/checkbox-dropdown.tsx";
import { hasAncestor } from "../../../util/html.ts";
import { useValueNotifier } from "../../../hooks/events.ts";
import { ApplicationSettings } from "../../../constants/settings.ts";

interface ISearchAllowedViewsProps {
    allowedViews: Set<string>;

    onAllowedViewsChanged(viewIds: Set<string>): void;
}

export const SearchAllowedViews: React.FC<ISearchAllowedViewsProps> = ({ allowedViews, onAllowedViewsChanged }) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const views = useViewsForNav();
    const dropdownRef = useRef<HTMLDivElement>(null);
    const homepageViewIds = useValueNotifier(ApplicationSettings.homepageViews);

    const options = useMemo(
        () => views.map(view => ({
            text: view.value.name,
            id: view.value.id
        })),
        [views]
    );

    useEffect(() => {
        if (!isDropdownOpen) {
            return;
        }

        const closeDropdown = (event: MouseEvent) => {
            const dropdown = dropdownRef.current;
            const target = event.target as HTMLElement;

            if (hasAncestor(target, dropdown)) {
                return;
            }

            setIsDropdownOpen(false);
        };

        window.addEventListener('click', closeDropdown);

        return () => {
            window.removeEventListener('click', closeDropdown);
        };
    }, [isDropdownOpen]);

    const onDropdownToggleClicked = (event: React.MouseEvent) => {
        event.stopPropagation();
        setIsDropdownOpen(!isDropdownOpen);
    }

    const onSelectHomeOnly = () => {
        const newSelectedOptions = new Set(homepageViewIds);
        onAllowedViewsChanged(newSelectedOptions);
    }

    const allowedViewCount = allowedViews.size === 0
        ? views.length
        : allowedViews.size;

    return (
        <div className="relative">
            <button onClick={onDropdownToggleClicked} className="default-container flex">
                <span>
                    Allowed Cafes
                </span>
                <span className="badge">
                    {allowedViewCount}
                </span>
            </button>
            {
                isDropdownOpen && (
                    <CheckboxDropdown
                        ref={dropdownRef}
                        id="search-allowed-views"
                        options={options}
                        selectedOptions={allowedViews}
                        onSelectedOptionsChanged={onAllowedViewsChanged}
                        buttons={
                            <>
                                {
                                    homepageViewIds.size > 0 && (
                                        <button onClick={onSelectHomeOnly} className="default-container shrink-padding">
                                        Select Home Only
                                        </button>
                                    )
                                }
                            </>
                        }
                    />
                )
            }
        </div>
    );
}