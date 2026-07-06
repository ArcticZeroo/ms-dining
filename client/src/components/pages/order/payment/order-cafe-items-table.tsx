import type { ICartItemRecord } from '@msdining/common/models/cart';
import React from 'react';
import { getOrderCafeStationGroupKey, useOrderCafeItemsTable } from '../../../../hooks/order-cafe-items-table.ts';
import { OrderCafeItemsTotalRows } from './order-cafe-items-total-rows.tsx';
import { OrderCafeStationItemGroup } from './order-cafe-station-item-group.tsx';
import '../cart/cart-contents-table.css';

interface IOrderCafeItemsTableProps {
    readOnly: boolean;
    hasUnavailableItems: boolean;
    items: ICartItemRecord[];
    onRemove: (item: ICartItemRecord) => void;
    onEdit: (item: ICartItemRecord) => void;
    onChangeQuantity: (item: ICartItemRecord, quantity: number) => void;
}

export const OrderCafeItemsTable: React.FC<IOrderCafeItemsTableProps> = ({
    readOnly,
    hasUnavailableItems,
    items,
    onRemove,
    onEdit,
    onChangeQuantity,
}) => {
    const { cafeId, estimate, stationGroups } = useOrderCafeItemsTable(items, hasUnavailableItems);

    return (
        <table className="cart-contents">
            <tbody>
                {stationGroups.map((stationGroup) => (
                    <OrderCafeStationItemGroup
                        key={getOrderCafeStationGroupKey(stationGroup.stationName)}
                        stationName={stationGroup.stationName}
                        stationItems={stationGroup.stationItems}
                        cafeId={cafeId}
                        readOnly={readOnly}
                        onRemove={onRemove}
                        onEdit={onEdit}
                        onChangeQuantity={onChangeQuantity}
                    />
                ))}
                <OrderCafeItemsTotalRows estimate={estimate}/>
            </tbody>
        </table>
    );
};