import { ISearchExplanationNearestItem } from '@msdining/common/models/search';
import React from 'react';
import { formatNumber, similarityFromDistance } from './explain-format.ts';

interface INearestItemRowProps {
    item: ISearchExplanationNearestItem;
}

export const NearestItemRow: React.FC<INearestItemRowProps> = ({ item }) => (
    <tr>
        <td>#{item.rank}</td>
        <td>{item.name ?? item.menuItemId}</td>
        <td>{formatNumber(item.distance)}</td>
        <td>{formatNumber(similarityFromDistance(item.distance))}</td>
    </tr>
);
