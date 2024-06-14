import { PromiseStage } from '@arcticzeroo/react-promise-hook';
import React from 'react';
import { classNames } from '../../util/react.ts';
import { HourglassLoadingSpinner } from '../icon/hourglass-loading-spinner.tsx';

interface ISearchWaitingProps {
    stage: PromiseStage;
}

export const SearchWaiting: React.FC<ISearchWaitingProps> = ({ stage }) => {
    const isVisible = stage === PromiseStage.running;
    return (
        <div className={classNames('icon-sized search-waiting', isVisible && 'visible')}>
            {
                isVisible && (
                    <HourglassLoadingSpinner/>
                )
            }
        </div>
    );
};