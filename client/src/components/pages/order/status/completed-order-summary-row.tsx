import React from 'react';
import { formatPrice } from '../../../../util/cart.ts';

interface ICompletedOrderSummaryRowProps {
    label: string;
    price: number;
    isEmphasized?: boolean;
}

export const CompletedOrderSummaryRow: React.FC<ICompletedOrderSummaryRowProps> = ({
    label,
    price,
    isEmphasized = false,
}) => {
    const formattedPrice = formatPrice(price);

    return (
        <tr>
            <td></td>
            <td>{isEmphasized ? <strong>{label}</strong> : label}</td>
            <td className="price">{isEmphasized ? <strong>{formattedPrice}</strong> : formattedPrice}</td>
        </tr>
    );
};
