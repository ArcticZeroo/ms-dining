import React from 'react';
import { classNames } from '../../util/react.ts';
import { HourglassLoadingSpinner } from '../icon/hourglass-loading-spinner.tsx';

interface ISearchWaitingProps {
    isPending: boolean;
}

export const SearchWaiting: React.FC<ISearchWaitingProps> = ({ isPending }) => {
    return (
        <div className={classNames('icon-sized search-waiting', isPending && 'visible')}>
            {isPending && <HourglassLoadingSpinner/>}
        </div>
    );
};