import React from 'react';
import { IPriceChangeItem } from '@msdining/common/models/price-history';
import { PriceChangeTable } from './price-change-table.tsx';

interface IPriceChangeListProps {
    title: string;
    items: IPriceChangeItem[];
}

export const PriceChangeList: React.FC<IPriceChangeListProps> = ({ title, items }) => (
    <div className="card flex-col price-change-list">
        <span className="price-change-list-title">{title}</span>
        <PriceChangeTable items={items}/>
    </div>
);
