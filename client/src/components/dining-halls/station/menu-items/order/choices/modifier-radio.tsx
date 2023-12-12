import { CafeTypes } from '@msdining/common';
import React from 'react';
import { getPriceDisplay } from '../../../../../../util/cart.ts';

interface IModifierRadioProps {
    modifier: CafeTypes.IMenuItemModifier;
    selectedChoiceId: string | null;

    onSelectedChoiceIdChanged(selection: string | null): void;
}

export const ModifierRadio: React.FC<IModifierRadioProps> = ({ modifier, selectedChoiceId, onSelectedChoiceIdChanged }) => {
    return (
        <div>
            {
                modifier.minimum === 0 && (
                    <div>
                        <input type="radio"
                               id="none"
                               name={modifier.id}
                               value="none"
                               checked={selectedChoiceId == null}
                               onChange={() => onSelectedChoiceIdChanged(null)}
                        />
                        <label htmlFor="none">None</label>
                    </div>
                )
            }
            {modifier.choices.map(choice => (
                <div key={choice.id}>
                    <input type="radio"
                           id={choice.id}
                           name={modifier.id}
                           value={choice.id}
                           checked={selectedChoiceId === choice.id}
                           onChange={() => onSelectedChoiceIdChanged(choice.id)}
                    />
                    <label htmlFor={choice.id}>{choice.description} {getPriceDisplay(choice.price)}</label>
                </div>
            ))}
        </div>
    );
};