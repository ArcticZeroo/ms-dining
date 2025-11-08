import { useViewsForNav } from "../../../hooks/views.ts";
import React, { useMemo, useState } from "react";
import { CheckboxDropdown } from "../../input/checkbox-dropdown.tsx";
import { useValueNotifier } from "../../../hooks/events.ts";
import { ApplicationSettings } from "../../../constants/settings.ts";

export const SearchAllowedViews: React.FC = () => {
    const allowedViewIds = useValueNotifier(ApplicationSettings.searchAllowedViewIds);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const views = useViewsForNav();
    const homepageViewIds = useValueNotifier(ApplicationSettings.homepageViews);

    const options = useMemo(
        () => views.map(view => ({
            text: view.value.name,
            id: view.value.id
        })),
        [views]
    );

    const onDropdownToggleClicked = (event: React.MouseEvent) => {
        event.stopPropagation();
        setIsDropdownOpen(!isDropdownOpen);
    }

    const onSelectHomeOnly = () => {
        ApplicationSettings.searchAllowedViewIds.value = new Set(homepageViewIds);
    }

    const allowedViewCount = allowedViewIds.size === 0
        ? views.length
        : allowedViewIds.size;

    return (
        <div className="relative">
            <button onClick={onDropdownToggleClicked} className="default-container flex">
                <span>
                    Allowed Cafes
                </span>
                <span className="number-badge">
                    {allowedViewCount}
                </span>
            </button>
            {
                isDropdownOpen && (
                    <CheckboxDropdown
                        onClose={() => setIsDropdownOpen(false)}
                        id="search-allowed-views"
                        options={options}
                        selectedOptions={allowedViewIds}
                        onSelectedOptionsChanged={selectedOptions => ApplicationSettings.searchAllowedViewIds.value = selectedOptions}
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