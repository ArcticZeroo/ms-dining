import { CafeMenu } from '../../../models/cafe.ts';
import React from 'react';
import { CollapsibleStation } from './collapsible-station.tsx';
import { classNames } from '../../../util/react.ts';

interface IStationListProps {
    stations: CafeMenu;
    isVisible: boolean;
}

export const StationList: React.FC<IStationListProps> = ({ stations, isVisible }) => {
    return (
        <div className={classNames('stations', !isVisible && 'hidden')}>
            {stations.length === 0 && `There's nothing here! This cafe is probably closed during this time.`}
            {stations.map(station => <CollapsibleStation key={station.name} station={station}/>)}
        </div>
    );
};