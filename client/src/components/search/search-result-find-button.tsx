import React from "react";
import { Link } from "react-router-dom";
import { getSearchUrl } from "../../util/url.ts";
import { pluralize } from "../../util/string.ts";

interface ISearchResultFindButtonProps {
    name: string;
    isSkeleton: boolean;
    cafeCount: number;
}

export const SearchResultFindButton: React.FC<ISearchResultFindButtonProps> = ({ name, isSkeleton, cafeCount }) => {
    const text = `🔍 find in ${isSkeleton ? '...' : cafeCount} ${pluralize('cafe', cafeCount)}`;

    return (
        <Link
            to={getSearchUrl(name)}
            className="default-container default-button text-center text-nowrap">
            {text}
        </Link>
    )
}