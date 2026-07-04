import React from 'react';

interface IPriceStatCardProps {
    label: string;
    value: string;
}

export const PriceStatCard: React.FC<IPriceStatCardProps> = ({ label, value }) => (
    <div className="card price-stat flex-col">
        <span className="price-stat-value">{value}</span>
        <span className="price-stat-label">{label}</span>
    </div>
);
