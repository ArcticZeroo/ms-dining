import { ISerializedCartItemWithName } from '../../../models/cart.ts';
import React, { useContext } from 'react';
import { CartHydrationContext } from '../../../context/cart.ts';

interface IMissingCartItemRowProps {
    cafeId: string;
    item: ISerializedCartItemWithName;
}

export const MissingCartItemRow: React.FC<IMissingCartItemRowProps> = ({ cafeId, item }) => {
    const cartHydrationNotifier = useContext(CartHydrationContext);
    const modifierCount = item.modifiers.reduce((count, modifier) => count + modifier.choiceIds.length, 0);

    const onRemove = () => {
        const newMissingItemsByCafeId = new Map(cartHydrationNotifier.value.missingItemsByCafeId);
        const missingItemsForCafe = newMissingItemsByCafeId.get(cafeId) ?? [];
        newMissingItemsByCafeId.set(cafeId, missingItemsForCafe.filter(missingItem => missingItem !== item));

        cartHydrationNotifier.value = {
            ...cartHydrationNotifier.value,
            missingItemsByCafeId: newMissingItemsByCafeId
        };
    };

    return (
        <tr className="cart-item">
            <td className="cart-item-buttons">
                <button
                    className="material-symbols-outlined"
                    onClick={onRemove}
                    title="Remove this item"
                >
                    delete
                </button>
            </td>
            <td className="quantity">{item.quantity}x</td>
            <td className="name">{item.name}</td>
            <td className="mono">
                {
                    modifierCount > 0 && `${modifierCount} modifier(s)`
                }
            </td>
        </tr>
    );
}