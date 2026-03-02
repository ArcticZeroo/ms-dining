import React, { useEffect, useRef } from 'react';
import { IAutocompleteSuggestion, SearchEntityType } from '@msdining/common/models/search';
import { entityDisplayDataByType } from '../../constants/search.ts';
import { classNames } from '../../util/react.ts';

import './search-autocomplete.css';

interface ISearchAutocompleteProps {
    suggestions: IAutocompleteSuggestion[];
    selectedIndex: number;
    onSelect(suggestion: IAutocompleteSuggestion): void;
}

const groupSuggestionsByEntityType = (suggestions: IAutocompleteSuggestion[]): Map<SearchEntityType, Array<IAutocompleteSuggestion>> => {
    const groupMap = new Map<SearchEntityType, Array<IAutocompleteSuggestion>>();

    for (const suggestion of suggestions) {
        const existing = groupMap.get(suggestion.entityType);
        if (existing) {
            existing.push(suggestion);
        } else {
            groupMap.set(suggestion.entityType, [suggestion]);
        }
    }

    return groupMap;
};

const AUTOCOMPLETE_GROUP_ORDER = [SearchEntityType.cafe, SearchEntityType.menuItem, SearchEntityType.station] as const;

export const SearchAutocomplete: React.FC<ISearchAutocompleteProps> = ({ suggestions, selectedIndex, onSelect }) => {
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const selectedElement = listRef.current?.querySelector('.autocomplete-item.selected');
        if (selectedElement) {
            selectedElement.scrollIntoView({ block: 'nearest' });
        }
    }, [selectedIndex]);

    if (suggestions.length === 0) {
        return null;
    }

    const groups = groupSuggestionsByEntityType(suggestions);
    let flatIndex = 0;

    return (
        <div className="autocomplete-dropdown" ref={listRef} onMouseDown={(event) => event.preventDefault()}>
            {AUTOCOMPLETE_GROUP_ORDER.map(entityType => {
                const suggestions = groups.get(entityType);
                if (!suggestions) {
                    return null;
                }

                return (
                    <div key={entityType} className="autocomplete-group">
                        {/*<div className="autocomplete-group-label">{group.label}</div>*/}
                        {suggestions.map(suggestion => {
                            const currentIndex = flatIndex++;
                            const isSelected = currentIndex === selectedIndex;
                            return (
                                <button
                                    key={`${entityType}-${suggestion.name}`}
                                    className={classNames('autocomplete-item', isSelected && 'selected')}
                                    onClick={() => onSelect(suggestion)}
                                    title={suggestion.name}
                                    type="button"
                                >
                                    <span className="material-symbols-outlined autocomplete-item-icon flex flex-center">
                                        {entityDisplayDataByType[suggestion.entityType].iconName}
                                    </span>
                                    <span className="autocomplete-item-name">{suggestion.name}</span>
                                </button>
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
};
