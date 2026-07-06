import React from 'react';
import type { IOrderCafeItemsEstimate } from '../../../../hooks/order-cafe-items-table.ts';
import { formatPrice } from '../../../../util/cart.ts';
import { OrderCafeItemsTotalRow } from './order-cafe-items-total-row.tsx';

interface IOrderCafeItemsTotalRowsProps {
    estimate?: IOrderCafeItemsEstimate;
}

export const OrderCafeItemsTotalRows: React.FC<IOrderCafeItemsTotalRowsProps> = ({ estimate }) => {
    if (!estimate || estimate.total <= 0) {
        return null;
    }

    return (
        <>
            <OrderCafeItemsTotalRow label="Subtotal" price={formatPrice(estimate.subtotal)}/>
            <OrderCafeItemsTotalRow label="Tax" price={formatPrice(estimate.tax)}/>
            <OrderCafeItemsTotalRow
                label={<strong>Total</strong>}
                price={<strong>{formatPrice(estimate.total)}</strong>}
            />
        </>
    );
};
