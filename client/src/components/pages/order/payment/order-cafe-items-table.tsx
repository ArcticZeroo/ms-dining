import type { ICartItemRecord } from '@msdining/common/models/cart';
import React, { useContext, useMemo } from 'react';
import { formatPrice, groupByStation } from '../../../../util/cart.ts';
import { useCartEstimateQuery } from '../../../../store/queries/ordering.ts';
import CartItemRow from '../cart/cart-item-row.tsx';
import { StationItemGroup } from '../cart/station-item-group.tsx';
import { CurrentCafeContext } from '../../../../context/menu-item.ts';
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
    const cafe = useContext(CurrentCafeContext);
    const cafeId = items[0]?.menuItem.cafeId;
    const stationGroups = useMemo(() => groupByStation(items), [items]);
    const { data: estimate } = useCartEstimateQuery(cafe.id);

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
                {
                    estimate && estimate.total > 0 && (
                        <>
                            <tr>
                                <td colSpan={2}></td>
                                <td>Subtotal</td>
                                <td className="price">{formatPrice(estimate.subtotal)}</td>
                            </tr>
                            <tr>
                                <td colSpan={2}></td>
                                <td>Tax</td>
                                <td className="price">{formatPrice(estimate.tax)}</td>
                            </tr>
                            <tr>
                                <td colSpan={2}></td>
                                <td><strong>Total</strong></td>
                                <td className="price"><strong>{formatPrice(estimate.total)}</strong></td>
                            </tr>
                        </>
                    )
                }
            </tbody>
        </table>
    );
};