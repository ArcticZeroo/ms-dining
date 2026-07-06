import type { ICafeOrderItem } from '@msdining/common/models/order';
import React from 'react';
import { useCompletedOrderItemsTable } from '../../../../hooks/completed-order-items-table.ts';
import { StationItemGroup } from '../cart/station-item-group.tsx';
import { CompletedOrderItemRow } from './completed-order-item-row.tsx';
import { CompletedOrderSummaryRow } from './completed-order-summary-row.tsx';
import '../cart/cart-contents-table.css';

interface ICompletedOrderItemsTableProps {
    items: ICafeOrderItem[];
    subtotal: number;
    tax: number;
    total: number;
    orderCompletedAt: Date;
    /** When true, show an inline review badge/CTA beneath each item. */
    showReviewRow?: boolean;
}

export const CompletedOrderItemsTable: React.FC<ICompletedOrderItemsTableProps> = ({
    items,
    subtotal,
    tax,
    total,
    orderCompletedAt,
    showReviewRow = false,
}) => {
    const { cafeId, stationGroups } = useCompletedOrderItemsTable(items);

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
                            <CompletedOrderItemRow
                                key={`${item.menuItemId}-${index}`}
                                item={item}
                                orderCompletedAt={orderCompletedAt}
                                showReviewRow={showReviewRow}
                            />
                        ))}
                    </StationItemGroup>
                ))}
                {
                    items.length > 1 && (
                        <CompletedOrderSummaryRow label="Subtotal" price={subtotal}/>
                    )
                }
                <CompletedOrderSummaryRow label="Tax" price={tax}/>
                <CompletedOrderSummaryRow label="Total" price={total} isEmphasized/>
            </tbody>
        </table>
    );
};