import type { ICafeOrderItem } from '@msdining/common/models/order';
import React from 'react';
import { formatPrice, groupByStation } from '../../../../util/cart.ts';
import { CartItemDetailCells } from '../cart/cart-item-detail-cells.tsx';
import { StationItemGroup } from '../cart/station-item-group.tsx';
import '../cart/cart-contents-table.css';

interface ICompletedOrderItemsTableProps {
    items: ICafeOrderItem[];
    subtotal: number;
    tax: number;
    total: number;
}

export const CompletedOrderItemsTable: React.FC<ICompletedOrderItemsTableProps> = ({ items, subtotal, tax, total }) => {
    const cafeId = items[0]?.menuItem.cafeId;
    const stationGroups = groupByStation(items);

    return (
        <table className="cart-contents">
            <tbody>
                {Array.from(stationGroups.entries()).map(([stationName, stationItems]) => (
                    <StationItemGroup
                        key={stationName || 'other'}
                        stationName={stationName}
                        cafeId={cafeId}
                    >
                        {stationItems.map((item, index) => (
                            <tr key={`${item.menuItemId}-${index}`} className="cart-item">
                                <CartItemDetailCells item={item}/>
                            </tr>
                        ))}
                    </StationItemGroup>
                ))}
                <tr>
                    <td></td>
                    <td>Subtotal</td>
                    <td className="price">{formatPrice(subtotal)}</td>
                </tr>
                <tr>
                    <td></td>
                    <td>Tax</td>
                    <td className="price">{formatPrice(tax)}</td>
                </tr>
                <tr>
                    <td></td>
                    <td><strong>Total</strong></td>
                    <td className="price"><strong>{formatPrice(total)}</strong></td>
                </tr>
            </tbody>
        </table>
    );
};