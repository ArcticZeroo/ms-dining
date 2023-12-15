import { PromiseStage } from '@arcticzeroo/react-promise-hook';
import { classNames } from '../../util/react.ts';
import React from 'react';

interface ISearchWaitingProps {
    stage: PromiseStage;
}

export const SearchWaiting: React.FC<ISearchWaitingProps> = ({ stage }) => {
    return (
        <div className={classNames('search-waiting', stage === PromiseStage.running && 'visible')}>
            <div className="loading-spinner"/>
            <div>
                Loading search results...
            </div>
        </div>
    );
};