import { PriceFiltersSetting } from "../../settings/price-filters-setting.tsx";
import React from "react";
import { SearchAllowedViews } from "./search-allowed-views.tsx";

export const SearchFilters: React.FC = () => {
    return (
        <div className="card">
            <PriceFiltersSetting/>
            <SearchAllowedViews/>
        </div>
    );
};