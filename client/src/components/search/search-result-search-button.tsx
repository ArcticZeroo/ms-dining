import React from 'react';
import { useNavigate } from 'react-router-dom';
import { navigateToSearch } from '../../util/search.js';

interface ISearchResultSearchButtonProps {
    name: string;
}

export const SearchResultSearchButton: React.FC<ISearchResultSearchButtonProps> = ({ name }) => {
    const navigate = useNavigate();

    const onNavigateToSearchClicked = () => {
        navigateToSearch(navigate, name);
    };

    return (
        <button
            className="default-container icon-container"
            title={`Click to search for "${name}"`}
            onClick={onNavigateToSearchClicked}
        >
            <span className="material-symbols-outlined">
                search
            </span>
        </button>
    );
};
