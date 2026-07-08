import React from "react";
import { SearchLink } from "./search-link.tsx";
import { pluralize } from "../../util/string.ts";

interface ISearchResultFindButtonProps {
    name: string;
    isSkeleton: boolean;
    cafeCount: number;
}

export const SearchResultFindButton: React.FC<ISearchResultFindButtonProps> = ({ name, isSkeleton, cafeCount }) => {
    const text = `🔍 find in ${isSkeleton ? '...' : cafeCount} ${pluralize('cafe', cafeCount)}`;

    return (
        <SearchLink
            query={name}
            className="default-container default-button text-center text-nowrap">
            {text}
        </SearchLink>
    )
}