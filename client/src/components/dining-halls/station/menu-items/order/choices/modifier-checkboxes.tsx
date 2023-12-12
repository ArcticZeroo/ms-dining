import { CafeTypes } from "@msdining/common";
import React from 'react';
import { getPriceDisplay } from '../../../../../../util/cart.ts';

interface IModifierCheckboxesProps {
    modifier: CafeTypes.IMenuItemModifier;
    selectedChoiceIds: Set<string>;
    onSelectedChoiceIdsChanged(selection: Set<string>): void;
}

export const ModifierCheckboxes: React.FC<IModifierCheckboxesProps> = ({ modifier, selectedChoiceIds, onSelectedChoiceIdsChanged }) => {
    const isAtMaximum = selectedChoiceIds.size >= modifier.maximum;

    const handleChoiceChange = (choiceId: string) => {
        const wasChoiceAlreadySelected = selectedChoiceIds.has(choiceId);

        if (!wasChoiceAlreadySelected && isAtMaximum) {
            return;
        }

        const newSelectedOptions = new Set(selectedChoiceIds);

        if (wasChoiceAlreadySelected) {
            newSelectedOptions.delete(choiceId);
        } else {
            newSelectedOptions.add(choiceId);
        }

        onSelectedChoiceIdsChanged(newSelectedOptions);
    };

    return (
        <div>
            {modifier.choices.map(choice => (
                <div key={choice.id} className="modifier-choice-option">
                    <input
                        type="checkbox"
                        id={choice.id}
                        name={choice.description}
                        value={choice.id}
                        onChange={() => handleChoiceChange(choice.id)}
                        checked={selectedChoiceIds.has(choice.id)}
                        disabled={isAtMaximum && !selectedChoiceIds.has(choice.id)}
                    />
                    <label htmlFor={choice.id}>{choice.description} {getPriceDisplay(choice.price)}</label>
                </div>
            ))}
        </div>
    );
}