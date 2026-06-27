import { IAutocompleteSuggestion, SearchEntityType } from '@msdining/common/models/search';
import React, { useState } from 'react';
import { useAutocompleteSuggestionsQuery } from '../../../../store/queries/search.ts';
import { useDebouncedValue } from '../../../../hooks/debounce.ts';
import { SearchAutocomplete } from '../../../search/search-autocomplete.tsx';

interface IItemNameInputProps {
    value: string;
    onChange: (value: string) => void;
}

const MAX_SUGGESTIONS = 8;

export const ItemNameInput: React.FC<IItemNameInputProps> = ({ value, onChange }) => {
    const [isFocused, setIsFocused] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);

    const debouncedQuery = useDebouncedValue(value.trim(), 200);
    const { data: suggestions } = useAutocompleteSuggestionsQuery(debouncedQuery);

    // The explain tool resolves menu items, so only suggest those.
    const menuItemSuggestions = (suggestions ?? [])
        .filter(suggestion => suggestion.entityType === SearchEntityType.menuItem)
        .slice(0, MAX_SUGGESTIONS);
    const showDropdown = isFocused && menuItemSuggestions.length > 0 && value.trim().length > 0;

    const select = (suggestion: IAutocompleteSuggestion) => {
        onChange(suggestion.name);
        setIsFocused(false);
        setSelectedIndex(-1);
    };

    const onKeyDown = (event: React.KeyboardEvent) => {
        if (!showDropdown) {
            return;
        }

        switch (event.key) {
        case 'ArrowDown':
            event.preventDefault();
            setSelectedIndex(index => Math.min(index + 1, menuItemSuggestions.length - 1));
            break;
        case 'ArrowUp':
            event.preventDefault();
            setSelectedIndex(index => Math.max(index - 1, 0));
            break;
        case 'Enter':
            if (selectedIndex >= 0) {
                event.preventDefault();
                select(menuItemSuggestions[selectedIndex]!);
            }
            break;
        case 'Escape':
            setIsFocused(false);
            break;
        }
    };

    return (
        <div className="explain-autocomplete-wrapper">
            <input
                type="text"
                placeholder="e.g. Quesabirria Tacos"
                value={value}
                onChange={event => {
                    onChange(event.target.value);
                    setSelectedIndex(-1);
                }}
                onFocus={() => setIsFocused(true)}
                // Delay so a click on a suggestion registers before the dropdown hides.
                onBlur={() => setTimeout(() => setIsFocused(false), 150)}
                onKeyDown={onKeyDown}
            />
            {
                showDropdown && (
                    <SearchAutocomplete
                        suggestions={menuItemSuggestions}
                        selectedIndex={selectedIndex}
                        onSelect={select}
                    />
                )
            }
        </div>
    );
};
