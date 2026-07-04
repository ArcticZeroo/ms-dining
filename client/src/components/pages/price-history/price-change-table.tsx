import React, { useContext } from 'react';
import { IPriceChangeItem } from '@msdining/common/models/price-history';
import { ApplicationContext } from '../../../context/app.ts';
import { tryGetViewName } from '../../../util/cafe.ts';
import { PriceChangeRow } from './price-change-row.tsx';

interface IPriceChangeTableProps {
    items: IPriceChangeItem[];
    emptyMessage?: string;
}

export const PriceChangeTable: React.FC<IPriceChangeTableProps> = ({ items, emptyMessage = 'No items.' }) => {
    const { viewsById } = useContext(ApplicationContext);

    if (items.length === 0) {
        return <span>{emptyMessage}</span>;
    }

    return (
        <table className="price-change-table">
            <thead>
                <tr>
                    <th>Item</th>
                    <th>Cafe</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Change</th>
                </tr>
            </thead>
            <tbody>
                {
                    items.map(item => (
                        <PriceChangeRow
                            key={`${item.cafeId}-${item.menuItemId}`}
                            item={item}
                            cafeName={tryGetViewName({ cafeId: item.cafeId, viewsById, showGroupName: true })}
                        />
                    ))
                }
            </tbody>
        </table>
    );
};
