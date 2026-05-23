import type { IMenuItemModifier } from '@msdining/common/dist/models/cafe.js';
import type { ICartItemRecord } from '@msdining/common/dist/models/cart.js';
import React from 'react';

const getModifierNameDisplay = (modifier: IMenuItemModifier) => {
    if (modifier.description.endsWith(':')) {
        return modifier.description;
    }

    return `${modifier.description}:`;
};

interface ICartItemModifiersProps {
    item: ICartItemRecord;
}

export const CartItemModifiers: React.FC<ICartItemModifiersProps> = ({ item }) => {
    const modifiers = item.menuItem.modifiers;
    const modifiersById = new Map(modifiers.map(modifier => [modifier.id, modifier]));

    return (
        <table className="modifiers">
            <tbody>
                {
                    item.specialInstructions && (
                        <tr className="modifier">
                            <td className="modifier-name">
                                Special Instructions:
                            </td>
                            <td className="modifier-choices">
                                {item.specialInstructions}
                            </td>
                        </tr>
                    )
                }
                {
                    item.modifiers.map(({ modifierId, choiceIds }) => {
                        const modifier = modifiersById.get(modifierId);

                        if (modifier == null) {
                            return null;
                        }

                        const choicesById = new Map(modifier.choices.map(choice => [choice.id, choice]));
                        const choiceDisplay = choiceIds
                            .map(choiceId => choicesById.get(choiceId)?.description ?? 'Unknown')
                            .join(', ');

                        return (
                            <tr className="modifier" key={modifierId}>
                                <td className="modifier-name">
                                    {getModifierNameDisplay(modifier)}
                                </td>
                                <td className="modifier-choices">
                                    {choiceDisplay}
                                </td>
                            </tr>
                        );
                    })
                }
            </tbody>
        </table>
    );
};
