import { CafeTypes } from '@msdining/common';
import React from 'react';
import { getChoiceHtmlId, getPriceDisplay } from '../../../../../../util/cart.ts';

interface IModifierRadioProps {
    modifier: CafeTypes.IMenuItemModifier;
    selectedChoiceId: string | null;

    onSelectedChoiceIdChanged(selection: string | null): void;
}

export const ModifierRadio: React.FC<IModifierRadioProps> = ({
                                                                 modifier,
                                                                 selectedChoiceId,
                                                                 onSelectedChoiceIdChanged
                                                             }) => {
    const noneChoiceId = `${modifier.id}-none`;

    return (
        <div className="modifier-choice-option-list">
            {
                modifier.minimum === 0 && (
                    <label className="modifier-choice-option" htmlFor={noneChoiceId}>
                        <input type="radio"
                               id={noneChoiceId}
                               name={modifier.id}
                               value="none"
                               checked={selectedChoiceId == null}
                               onChange={() => onSelectedChoiceIdChanged(null)}
                        />
                        <label htmlFor={noneChoiceId}>None</label>
                    </label>
                )
            }
            {modifier.choices.map(choice => (
                <label key={choice.id} htmlFor={getChoiceHtmlId(modifier, choice)} className="modifier-choice-option">
                    <input type="radio"
                           id={getChoiceHtmlId(modifier, choice)}
                           name={modifier.id}
                           value={choice.id}
                           checked={selectedChoiceId === choice.id}
                           onChange={() => onSelectedChoiceIdChanged(choice.id)}
                    />
                    <span>{choice.description} {getPriceDisplay(choice.price)}</span>
                </label>
            ))}
        </div>
    );
};