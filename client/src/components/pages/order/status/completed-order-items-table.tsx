import type { ICafeOrderItem } from '@msdining/common/models/order';
import React from 'react';
import { formatPrice, groupByStation } from '../../../../util/cart.ts';
import { CartItemDetailCells } from '../cart/cart-item-detail-cells.tsx';
import { StationItemGroup } from '../cart/station-item-group.tsx';
import { OrderItemReviewRow } from '../history/order-item-review-row.tsx';
import '../cart/cart-contents-table.css';

const COLUMN_COUNT = 4;

interface ICompletedOrderItemsTableProps {
    items: ICafeOrderItem[];
    subtotal: number;
    tax: number;
    total: number;
    /** When true, show an inline review badge/CTA beneath each item. */
    showReviewRow?: boolean;
}

export const CompletedOrderItemsTable: React.FC<ICompletedOrderItemsTableProps> = ({
    items,
    subtotal,
    tax,
    total,
    showReviewRow = false,
}) => {
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
                            <React.Fragment key={`${item.menuItemId}-${index}`}>
                                <tr className="cart-item">
                                    <CartItemDetailCells item={item}/>
                                </tr>
                                {
                                    showReviewRow && (
                                        <OrderItemReviewRow item={item} columnCount={COLUMN_COUNT}/>
                                    )
                                }
                            </React.Fragment>
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