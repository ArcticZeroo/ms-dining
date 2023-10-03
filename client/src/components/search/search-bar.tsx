import searchIcon from '../../assets/search.svg';
import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface ISearchBarProps {
    onSubmit(): void;
}

export const SearchBar: React.FC<ISearchBarProps> = ({ onSubmit }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [query, setQuery] = useState('');
    const navigate = useNavigate();

    const onFormSubmitted = (event: React.FormEvent) => {
        event.preventDefault();

        const trimmedQuery = query.trim();

        if (trimmedQuery.length === 0) {
            inputRef?.current?.focus();
        } else {
            navigate(`/search?q=${trimmedQuery}`);
            onSubmit();
        }
    };

    return (
        <li className="search-bar-container">
            <form className="search-bar" onSubmit={onFormSubmitted}>
                <input type="text" placeholder="Search..."
                       ref={inputRef}
                       value={query}
                       onChange={event => setQuery(event.target.value)}/>
                <button type="submit" className="search-button">
                    <img src={searchIcon} alt="Search Icon"/>
                </button>
            </form>
        </li>
    );
};