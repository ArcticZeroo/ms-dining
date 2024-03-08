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
            <td>
                <div className="cart-item-buttons">
                    <button
                        className="material-symbols-outlined"
                        onClick={onRemove}
                        title="Remove this item"
                    >
                        delete
                    </button>
                </div>
            </td>
            <td className="quantity">{item.quantity}x</td>
            <td className="name">{item.name}</td>
            {/*Just to avoid needing a new class name to match up with the table. /shrug*/}
            <td className="price">
                {
                    modifierCount > 0 && `${modifierCount} modifier(s)`
                }
            </td>
        </tr>
    );
}