import { ISearchExplanation } from '@msdining/common/models/search';
import React from 'react';
import { ExplainSummary } from './explain-summary.tsx';
import { ExplainItemList } from './explain-item-list.tsx';
import { NearestItems } from './nearest-items.tsx';

interface IExplainResultProps {
    explanation: ISearchExplanation;
}

export const ExplainResult: React.FC<IExplainResultProps> = ({ explanation }) => (
    <div className="flex-col">
        <ExplainSummary explanation={explanation}/>
        <ExplainItemList items={explanation.items}/>
        <NearestItems items={explanation.nearestMenuItems}/>
    </div>
);
