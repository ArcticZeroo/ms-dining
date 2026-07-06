import type { ICartItemRecord } from '@msdining/common/models/cart';
import React from 'react';
import { StationItemGroup } from '../cart/station-item-group.tsx';
import { OrderCafeItemRow } from './order-cafe-item-row.tsx';

interface IOrderCafeStationItemGroupProps {
    stationName: string;
    stationItems: ICartItemRecord[];
    cafeId?: string;
    readOnly: boolean;
    onRemove: (item: ICartItemRecord) => void;
    onEdit: (item: ICartItemRecord) => void;
    onChangeQuantity: (item: ICartItemRecord, quantity: number) => void;
}

export const OrderCafeStationItemGroup: React.FC<IOrderCafeStationItemGroupProps> = ({
    stationName,
    stationItems,
    cafeId,
    readOnly,
    onRemove,
    onEdit,
    onChangeQuantity,
}) => (
    <StationItemGroup stationName={stationName} cafeId={cafeId}>
        {stationItems.map((item) => (
            <OrderCafeItemRow
                key={item.id}
                item={item}
                readOnly={readOnly}
                onRemove={onRemove}
                onEdit={onEdit}
                onChangeQuantity={onChangeQuantity}
            />
        ))}
    </StationItemGroup>
);
