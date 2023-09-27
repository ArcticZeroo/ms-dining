import { DiningHallMenu } from '../../../models/dining-halls.ts';
import React from 'react';
import { Station } from './station.tsx';
import { classNames } from '../../../util/react.ts';

interface IStationListProps {
    stations: DiningHallMenu;
    isVisible: boolean;
}

export const StationList: React.FC<IStationListProps> = ({ stations, isVisible }) => {
    return (
        <div className={classNames('stations', !isVisible && 'hidden')}>
            {stations.map(station => <Station key={station.name} station={station}/>)}
        </div>
    );
};