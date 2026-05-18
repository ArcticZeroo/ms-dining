import { ISerializedCartItemWithName } from '../../../models/cart.ts';
import React from 'react';
import { useCartStore } from '../../../store/zustand/cart.ts';
import { pluralize } from '../../../util/string.ts';

interface IMissingCartItemRowProps {
    cafeId: string;
    item: ISerializedCartItemWithName;
    index: number;
}

export const MissingCartItemRow: React.FC<IMissingCartItemRowProps> = ({ cafeId, item, index }) => {
    const removeMissingItemAt = useCartStore((state) => state.removeMissingItemAt);
    const modifierCount = item.modifiers.reduce((count, modifier) => count + modifier.choiceIds.length, 0);

    const onRemove = () => {
        removeMissingItemAt(cafeId, index);
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
                    modifierCount > 0 && `${modifierCount} ${pluralize('modifier', modifierCount)}`
                }
            </td>
        </tr>
    );
}