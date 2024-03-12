import { PromiseStage } from '@arcticzeroo/react-promise-hook';
import React from 'react';
import { classNames } from '../../util/react.ts';
import { HourglassLoadingSpinner } from '../icon/hourglass-loading-spinner.tsx';

interface ISearchWaitingProps {
    stage: PromiseStage;
}

export const SearchWaiting: React.FC<ISearchWaitingProps> = ({ stage }) => {
    return (
        <div className={classNames('search-waiting', stage === PromiseStage.running && 'visible')}>
            <HourglassLoadingSpinner/>
            <div>
                Loading search results...
            </div>
        </div>
    );
};