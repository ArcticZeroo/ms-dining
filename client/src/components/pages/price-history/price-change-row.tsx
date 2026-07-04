import React from 'react';
import { IPriceChangeItem } from '@msdining/common/models/price-history';
import { formatPrice } from '../../../util/cart.ts';
import { formatSignedDollars, formatSignedPercent } from './price-history-format.ts';

interface IPriceChangeRowProps {
    item: IPriceChangeItem;
    cafeName: string;
}

export const PriceChangeRow: React.FC<IPriceChangeRowProps> = ({ item, cafeName }) => (
    <tr>
        <td>{item.name}</td>
        <td>{cafeName}</td>
        <td>{formatPrice(item.fromAmount)}</td>
        <td>{formatPrice(item.toAmount)}</td>
        <td>{formatSignedDollars(item.increaseDollars)} ({formatSignedPercent(item.increasePercent)})</td>
    </tr>
);
