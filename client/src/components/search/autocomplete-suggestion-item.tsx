import React from 'react';
import { IAutocompleteSuggestion } from '@msdining/common/models/search';
import { entityDisplayDataByType } from '../../constants/search.ts';
import { classNames } from '../../util/react.ts';

interface IAutocompleteSuggestionItemProps {
    suggestion: IAutocompleteSuggestion;
    isSelected: boolean;
    onSelect(suggestion: IAutocompleteSuggestion): void;
}

export const AutocompleteSuggestionItem: React.FC<IAutocompleteSuggestionItemProps> = ({ suggestion, isSelected, onSelect }) => (
    <button
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
