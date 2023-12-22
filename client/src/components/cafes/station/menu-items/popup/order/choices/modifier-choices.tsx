import { CafeTypes } from '@msdining/common';
import React from 'react';
import { ModifierCheckboxes } from './modifier-checkboxes.tsx';
import { ModifierRadio } from './modifier-radio.tsx';

interface IModifierChoicesProps {
    modifier: CafeTypes.IMenuItemModifier;
    selectedChoiceIds: Set<string>;
    onSelectedChoiceIdsChanged(selection: Set<string>): void;
}

export const ModifierChoices: React.FC<IModifierChoicesProps> = ({ modifier, selectedChoiceIds, onSelectedChoiceIdsChanged }) => {
    if (modifier.choiceType === CafeTypes.ModifierChoices.radio) {
        const choice = selectedChoiceIds.size === 0 ? null : Array.from(selectedChoiceIds)[0];

        const onRadioChoiceChanged = (choice: string | null) => {
            if (choice == null) {
                onSelectedChoiceIdsChanged(new Set<string>());
            } else {
                onSelectedChoiceIdsChanged(new Set<string>([choice]));
            }
        }

        return (
            <ModifierRadio
                modifier={modifier}
                selectedChoiceId={choice}
                onSelectedChoiceIdChanged={onRadioChoiceChanged}
            />
        );
    }

    if (modifier.choiceType === CafeTypes.ModifierChoices.checkbox) {
        return (
            <ModifierCheckboxes
                modifier={modifier}
                selectedChoiceIds={selectedChoiceIds}
                onSelectedChoiceIdsChanged={onSelectedChoiceIdsChanged}
            />
        );
    }

    if (modifier.choiceType === CafeTypes.ModifierChoices.multiSelect) {
        return 'multi select (not yet implemented)';
    }

    console.error('Unknown modifier choice type', modifier.choiceType);
    return null;
};