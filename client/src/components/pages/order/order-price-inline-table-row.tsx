import React from 'react';
import { formatPrice } from '../../../util/cart.ts';

interface IOrderPriceInlineTableRowProps {
    label: string;
    price?: number;
    isLoading?: boolean;
}

export const OrderPriceInlineTableRow: React.FC<IOrderPriceInlineTableRowProps> = ({ label, price, isLoading }) => (
    <tr>
        <td colSpan={1}/>
        <td>{label}</td>
        <td className="price">{price != null ? formatPrice(price) : (isLoading ? 'Loading…' : 'Unavailable')}</td>
        <td colSpan={1}/>
    </tr>
);
