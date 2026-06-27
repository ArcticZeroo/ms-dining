import { ISearchExplanationNearestItem } from '@msdining/common/models/search';
import React from 'react';
import { NearestItemRow } from './nearest-item-row.tsx';

interface INearestItemsProps {
    items: ISearchExplanationNearestItem[];
}

export const NearestItems: React.FC<INearestItemsProps> = ({ items }) => (
    <details className="card explain-nearest">
        <summary>Nearest menu items for this query ({items.length})</summary>
        <table className="explain-nearest-table">
            <thead>
                <tr><th>Rank</th><th>Name</th><th>Distance</th><th>Similarity</th></tr>
            </thead>
            <tbody>
                {items.map(item => <NearestItemRow key={item.menuItemId} item={item}/>)}
            </tbody>
        </table>
    </details>
);
