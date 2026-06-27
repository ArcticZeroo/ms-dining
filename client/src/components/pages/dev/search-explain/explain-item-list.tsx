import { ISearchExplanationItem } from '@msdining/common/models/search';
import React from 'react';
import { ExplainItemCard } from './explain-item-card.tsx';

interface IExplainItemListProps {
    items: ISearchExplanationItem[];
}

export const ExplainItemList: React.FC<IExplainItemListProps> = ({ items }) => {
    if (items.length === 0) {
        return (
            <div className="card error">
                No menu item found for that name. Try a different name or an exact menu item id.
            </div>
        );
    }

    return (
        <>
            {items.map(item => <ExplainItemCard key={item.menuItemId} item={item}/>)}
        </>
    );
};
