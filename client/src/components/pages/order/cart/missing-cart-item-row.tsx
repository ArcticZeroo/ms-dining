import type { ICartItemRecord } from '@msdining/common/models/cart';
import React from 'react';
import { useIsCartItemBusy, useRemoveCartItemMutation } from '../../../../store/queries/server-cart.ts';
import { CartItemDetailCells } from './cart-item-detail-cells.tsx';
import { HourglassLoadingSpinner } from '../../../icon/hourglass-loading-spinner.tsx';

interface IMissingCartItemRowProps {
    item: ICartItemRecord;
}

export const MissingCartItemRow: React.FC<IMissingCartItemRowProps> = ({ item }) => {
    const removeItem = useRemoveCartItemMutation();
    const isBusy = useIsCartItemBusy(item.id);

    return (
        <tr className="cart-item unavailable">
            <td>
                <div className="cart-item-buttons">
                    {
                        isBusy && <HourglassLoadingSpinner/>
                    }
                    {
                        !isBusy && (
                            <button
                                className="material-symbols-outlined"
                                onClick={() => removeItem.mutate(item.id)}
                                title="Remove this item"
                            >
                                delete
                            </button>
                        )
                    }
                </div>
            </td>
            <CartItemDetailCells item={item}/>
        </tr>
    );
};
