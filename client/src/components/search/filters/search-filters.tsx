import { PriceFiltersSetting } from "../../settings/price-filters-setting.tsx";
import React from "react";
import { SearchAllowedViews } from "./search-allowed-views.tsx";

interface ISearchFiltersProps {
    allowedViews: Set<string>;
    onAllowedViewsChanged(viewIds: Set<string>): void;
}

export const SearchFilters: React.FC<ISearchFiltersProps> = ({ allowedViews, onAllowedViewsChanged }) => {
    return (
        <div className="card">
            <PriceFiltersSetting/>
            <SearchAllowedViews
                allowedViews={allowedViews}
                onAllowedViewsChanged={onAllowedViewsChanged}
            />
        </div>
    );
};