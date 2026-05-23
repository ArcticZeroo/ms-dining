import type { ICartItemRecord } from '@msdining/common/models/cart';
import React from 'react';
import { useRemoveCartItemMutation } from '../../../../store/queries/server-cart.ts';

interface IMissingCartItemRowProps {
    item: ICartItemRecord;
}

export const MissingCartItemRow: React.FC<IMissingCartItemRowProps> = ({ item }) => {
    const removeItem = useRemoveCartItemMutation();

    return (
        <tr className="cart-item unavailable">
            <td>
                <div className="cart-item-buttons">
                    <button
                        className="material-symbols-outlined"
                        onClick={() => removeItem.mutate(item.id)}
                        title="Remove this item"
                    >
                        delete
                    </button>
                </div>
            </td>
            <td className="quantity">{item.quantity}x</td>
            <td className="name">{item.menuItem.name}</td>
            <td className="price">Unavailable</td>
        </tr>
    );
};
