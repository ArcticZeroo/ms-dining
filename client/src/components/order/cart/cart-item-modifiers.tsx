import React from 'react';
import { ICartItemWithMetadata } from '../../../models/cart.ts';
import { IMenuItemModifier } from '@msdining/common/dist/models/cafe.ts';

const getModifierNameDisplay = (modifier: IMenuItemModifier) => {
    if (modifier.description.endsWith(':')) {
        return modifier.description;
    }

    return `${modifier.description}:`;
}

interface ICartItemModifiersProps {
    item: ICartItemWithMetadata;
}

export const CartItemModifiers: React.FC<ICartItemModifiersProps> = ({ item }) => {
    const modifiers = item.associatedItem.modifiers;
    const modifiersById = new Map(modifiers.map(modifier => [modifier.id, modifier]));

    return (
        <table className="modifiers">
            <tbody>
                {
                    Array.from(item.choicesByModifierId.entries())
                        .map(([modifierId, choice]) => {
                            const modifier = modifiersById.get(modifierId);

                            if (modifier == null) {
                                return null;
                            }

                            const choicesById = new Map(modifier.choices.map(choice => [choice.id, choice]));
                            const choiceDisplay = Array.from(choice.values())
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
}