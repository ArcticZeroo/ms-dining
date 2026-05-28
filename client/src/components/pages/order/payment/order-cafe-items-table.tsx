import type { ICartItemRecord } from '@msdining/common/models/cart';
import React, { useMemo } from 'react';
import { groupByStation } from '../../../../util/cart.ts';
import CartItemRow from '../cart/cart-item-row.tsx';
import { StationItemGroup } from '../cart/station-item-group.tsx';
import '../cart/cart-contents-table.css';

interface IOrderCafeItemsTableProps {
    items: ICartItemRecord[];
    readOnly: boolean;
    onRemove: (item: ICartItemRecord) => void;
    onEdit: (item: ICartItemRecord) => void;
    onChangeQuantity: (item: ICartItemRecord, quantity: number) => void;
}

export const OrderCafeItemsTable: React.FC<IOrderCafeItemsTableProps> = ({
    items,
    readOnly,
    onRemove,
    onEdit,
    onChangeQuantity,
}) => {
    const cafeId = items[0]?.menuItem.cafeId;
    const stationGroups = useMemo(() => groupByStation(items), [items]);

    return (
        <table className="cart-contents">
            <tbody>
                {Array.from(stationGroups.entries()).map(([stationName, stationItems]) => (
                    <StationItemGroup
                        key={stationName || 'other'}
                        stationName={stationName}
                        cafeId={cafeId}
                    >
                        {stationItems.map((item) => (
                            <CartItemRow
                                key={item.id}
                                item={item}
                                readOnly={readOnly}
                                onRemove={() => onRemove(item)}
                                onEdit={() => onEdit(item)}
                                onChangeQuantity={(quantity) => onChangeQuantity(item, quantity)}
                            />
                        ))}
                    </StationItemGroup>
                ))}
            </tbody>
        </table>
    );
};