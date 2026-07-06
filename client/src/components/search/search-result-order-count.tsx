import React from 'react';
import { useSearchResultOrderCountDisplay } from '../../hooks/search-result.ts';

interface ISearchResultOrderCountProps {
    entityKey?: string;
}

export const SearchResultOrderCount: React.FC<ISearchResultOrderCountProps> = ({ entityKey }) => {
    const orderCountDisplay = useSearchResultOrderCountDisplay(entityKey);

    if (!orderCountDisplay) {
        return null;
    }

    return (
        <div className="search-result-review-score">
            {orderCountDisplay}
        </div>
    );
};
