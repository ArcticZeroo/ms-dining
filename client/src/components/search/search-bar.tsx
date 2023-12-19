import React, { useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import searchIcon from '../../assets/search.svg';
import { SearchQueryContext } from '../../context/search.ts';
import { useValueNotifier } from '../../hooks/events.ts';

export const SearchBar = () => {
    const inputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();
    const searchQueryNotifier = useContext(SearchQueryContext);
    const searchQuery = useValueNotifier(searchQueryNotifier);

    const onFormSubmitted = (event: React.FormEvent) => {
        event.preventDefault();

        const trimmedQuery = searchQuery.trim();

        if (trimmedQuery.length === 0) {
            inputRef?.current?.focus();
        } else {
            navigate(`/search?q=${trimmedQuery}`);
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
                    <img src={searchIcon} alt="Search Icon"/>
                </button>
            </form>
        </li>
    );
};