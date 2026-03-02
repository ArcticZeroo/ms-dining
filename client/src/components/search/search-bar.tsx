import React, { useCallback, useContext, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchQueryContext } from '../../context/search.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { navigateToSearch } from '../../util/search.ts';
import { NavExpansionContext } from '../../context/nav.ts';
import { useAutocompleteSuggestions } from '../../hooks/autocomplete.ts';
import { SearchAutocomplete } from './search-autocomplete.tsx';
import { IAutocompleteSuggestion } from '@msdining/common/models/search';

export const SearchBar = () => {
    const inputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();
    const searchQueryNotifier = useContext(SearchQueryContext);
    const searchQuery = useValueNotifier(searchQueryNotifier);
    const [, setIsNavExpanded] = useContext(NavExpansionContext);
    const { suggestions, clearSuggestions } = useAutocompleteSuggestions(searchQuery);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [isFocused, setIsFocused] = useState(false);
    
    const deselectSuggestion = useCallback(() => {
        setSelectedIndex(-1);
    }, []);

    const submitSearch = useCallback((query: string) => {
        const trimmedQuery = query.trim().toLowerCase();
        if (trimmedQuery.length > 0) {
            navigateToSearch(navigate, trimmedQuery);
            setIsNavExpanded(false);
            clearSuggestions();
            deselectSuggestion();
            inputRef.current?.blur();
        }
    }, [navigate, setIsNavExpanded, clearSuggestions, deselectSuggestion]);

    const onFormSubmitted = (event: React.FormEvent) => {
        event.preventDefault();

        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
            const selectedSuggestion = suggestions[selectedIndex];
            if (selectedSuggestion) {
                onSuggestionSelected(selectedSuggestion);
                return;
            }
        }

        if (searchQuery.trim().length === 0) {
            inputRef?.current?.focus();
        } else {
            submitSearch(searchQuery);
        }
    };

    const onInputChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
        searchQueryNotifier.value = event.target.value;
        deselectSuggestion();
    };

    const onSuggestionSelected = (suggestion: IAutocompleteSuggestion) => {
        searchQueryNotifier.value = suggestion.name;
        submitSearch(suggestion.name);
    };

    const onKeyDown = (event: React.KeyboardEvent) => {
        if (suggestions.length === 0) {
            return;
        }

        switch (event.key) {
        case 'ArrowDown':
            event.preventDefault();
            setSelectedIndex(previous => Math.min(previous + 1, suggestions.length - 1));
            break;
        case 'ArrowUp':
            event.preventDefault();
            setSelectedIndex(previous => Math.max(previous - 1, -1));
            break;
        case 'Escape':
            clearSuggestions();
            setSelectedIndex(-1);
            break;
        }
    };

    const showAutocomplete = isFocused && suggestions.length > 0;

    return (
        <li className="search-bar-container">
            <form className="search-bar" onSubmit={onFormSubmitted} style={{ position: 'relative' }}>
                <input type="text" placeholder="Search..."
                    ref={inputRef}
                    value={searchQuery}
                    onChange={onInputChanged}
                    onKeyDown={onKeyDown}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    autoComplete="off"/>
                <button type="submit" className="search-button">
                    <span className="material-symbols-outlined">
                        search
                    </span>
                </button>
                {showAutocomplete && (
                    <SearchAutocomplete
                        suggestions={suggestions}
                        selectedIndex={selectedIndex}
                        onSelect={onSuggestionSelected}
                    />
                )}
            </form>
        </li>
    );
};