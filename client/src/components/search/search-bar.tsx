import React, { useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchQueryContext } from '../../context/search.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { navigateToSearch } from '../../util/search.ts';
import { NavExpansionContext } from "../../context/nav.ts";

export const SearchBar = () => {
    const inputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();
    const searchQueryNotifier = useContext(SearchQueryContext);
    const searchQuery = useValueNotifier(searchQueryNotifier);
    const [, setIsNavExpanded] = useContext(NavExpansionContext);

    const onFormSubmitted = (event: React.FormEvent) => {
        event.preventDefault();

        const trimmedQuery = searchQuery.trim().toLowerCase();

        if (trimmedQuery.length === 0) {
            inputRef?.current?.focus();
        } else {
            navigateToSearch(navigate, trimmedQuery);
            setIsNavExpanded(false);
        }
    };

    const onInputChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
        searchQueryNotifier.value = event.target.value;
    };

    return (
        <li className="search-bar-container">
            <form className="search-bar" onSubmit={onFormSubmitted}>
                <input type="text" placeholder="Search..."
                    ref={inputRef}
                    value={searchQuery}
                    onChange={onInputChanged}/>
                <button type="submit" className="search-button">
                    <span className="material-symbols-outlined">
                        search
                    </span>
                </button>
            </form>
        </li>
    );
};