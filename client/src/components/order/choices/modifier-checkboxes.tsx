import { CafeTypes } from '@msdining/common';
import React from 'react';
import { getChoiceHtmlId, maybeFormatPrice } from '../../../util/cart.ts';
import { classNames } from '../../../util/react.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { DebugSettings } from '../../../constants/settings.ts';

interface IModifierCheckboxesProps {
    modifier: CafeTypes.IMenuItemModifier;
    selectedChoiceIds: Set<string>;

    onSelectedChoiceIdsChanged(selection: Set<string>): void;
}

export const ModifierCheckboxes: React.FC<IModifierCheckboxesProps> = ({
    modifier,
    selectedChoiceIds,
    onSelectedChoiceIdsChanged
}) => {
    const isOnlineOrderingAllowed = useValueNotifier(DebugSettings.allowOnlineOrdering);
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
        <div className="modifier-choice-option-list">
            {modifier.choices.map(choice => {
                const htmlId = getChoiceHtmlId(modifier, choice);

                const isSelected = selectedChoiceIds.has(choice.id);
                const isDisabled = isAtMaximum && !isSelected;

                return (
                    <label key={choice.id}
                        htmlFor={htmlId}
                        className={classNames('modifier-choice-option', isDisabled && 'disabled')}>
                        {
                            isOnlineOrderingAllowed && (
                                <input
                                    type="checkbox"
                                    id={htmlId}
                                    name={choice.description}
                                    value={choice.id}
                                    onChange={() => handleChoiceChange(choice.id)}
                                    checked={isSelected}
                                    disabled={isDisabled}
                                />
                            )
                        }
                        <span>{choice.description} {maybeFormatPrice(choice.price)}</span>
                    </label>
                );
            })}
        </div>
    );
}