import React from 'react';
import { IPriceCafeSummary } from '@msdining/common/models/price-history';
import { formatPrice } from '../../../util/cart.ts';
import { formatPercent } from './price-history-format.ts';

interface IPriceCafeChipProps {
    cafe: IPriceCafeSummary;
    cafeName: string;
}

export const PriceCafeChip: React.FC<IPriceCafeChipProps> = ({ cafe, cafeName }) => (
    <div className="card price-percafe-chip flex-col">
        <span className="price-percafe-name">{cafeName}</span>
        <span className="price-percafe-value">{formatPercent(cafe.averageIncreasePercent)}</span>
        <span className="price-percafe-sub">
            {formatPrice(cafe.averageIncreaseDollars)} avg · {cafe.increasedCount}/{cafe.totalItems} up
        </span>
    </div>
);
