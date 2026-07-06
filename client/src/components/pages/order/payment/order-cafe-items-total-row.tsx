import React from 'react';

interface IOrderCafeItemsTotalRowProps {
    label: React.ReactNode;
    price: React.ReactNode;
}

export const OrderCafeItemsTotalRow: React.FC<IOrderCafeItemsTotalRowProps> = ({ label, price }) => (
    <tr>
        <td colSpan={2}></td>
        <td>{label}</td>
        <td className="price">{price}</td>
    </tr>
);
