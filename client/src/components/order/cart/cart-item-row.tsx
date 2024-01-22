import React, { useMemo } from 'react';
import { ICartItemWithMetadata } from '../../../models/cart.ts';
import { getPriceDisplay } from '../../../util/cart.ts';
import { IMenuItemModifier } from '@msdining/common/dist/models/cafe';

const MAX_QUANTITY = 99;

const getModifierNameDisplay = (modifier: IMenuItemModifier) => {
    if (modifier.description.endsWith(':')) {
        return modifier.description;
    }

    return `${modifier.description}:`;
}

interface ICartItemProps {
    showModifiers: boolean;
    item: ICartItemWithMetadata;
    onRemove: () => void;
    onEdit: () => void;
    onChangeQuantity: (quantity: number) => void;
}

export const CartItemRow: React.FC<ICartItemProps> = ({ item, onRemove, onEdit, onChangeQuantity, showModifiers }) => {
    const canDecreaseQuantity = item.quantity > 1;
    const canIncreaseQuantity = item.quantity < MAX_QUANTITY;

    const onDecreaseQuantity = () => {
        if (!canDecreaseQuantity) {
            return;
        }

        onChangeQuantity(item.quantity - 1);
    }

    const onIncreaseQuantity = () => {
        if (!canIncreaseQuantity) {
            return;
        }

        onChangeQuantity(item.quantity + 1);
    }

    const modifiersDisplay = useMemo(
        () => {
            if (!showModifiers || item.choicesByModifierId.size === 0) {
                return null;
            }

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
                                        <tr className="modifier">
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
        },
        [showModifiers, item]
    );

    return (
        <tr className="cart-item">
            <td>
                <div className="cart-item-buttons">
                    <button
                        className="material-symbols-outlined"
                        onClick={onRemove}
                        title="Remove this item"
                    >
                        delete
                    </button>
                    <button
                        className="material-symbols-outlined"
                        disabled={!canDecreaseQuantity}
                        onClick={onDecreaseQuantity}
                        title={canDecreaseQuantity ? 'Remove one more' : 'Use the trash can to remove this item'}
                    >
                        remove
                    </button>
                    <button
                        className="material-symbols-outlined"
                        disabled={!canIncreaseQuantity}
                        onClick={onIncreaseQuantity}
                        title={canIncreaseQuantity ? 'Add one more' : 'You can only order up to 99 of each item'}
                    >
                        add
                    </button>
                    <button
                        className="material-symbols-outlined"
                        onClick={onEdit}
                        title="Edit this item"
                    >
                        edit
                    </button>
                </div>
            </td>
            <td className="quantity">
                {item.quantity}x
            </td>
            <td className="name">
                {
                    showModifiers
                        ? (
                            <div className="name-and-modifiers">
                                {item.associatedItem.name}
                                {modifiersDisplay}
                            </div>
                        )
                        : item.associatedItem.name
                }
            </td>
            <td className="price">
                {getPriceDisplay(item.price * item.quantity)}
            </td>
        </tr>
    );
}