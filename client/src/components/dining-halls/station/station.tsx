import { IDiningHallStation } from '../../../models/dining-halls.ts';
import React, { useState } from 'react';
import { StationMenu } from './menu-items/station-menu.tsx';
import { ExpandIcon } from '../../icon/expand.tsx';
import { classNames } from '../../../util/react.ts';

export interface IDiningHallStationProps {
    station: IDiningHallStation;
}

export const Station: React.FC<IDiningHallStationProps> = ({ station }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    const toggleIsExpanded = () => {
        setIsExpanded(!isExpanded);
    }

    return (
        <div className={classNames('station', !isExpanded && 'collapsed')}>
            <button className="title" onClick={toggleIsExpanded}>
                {
                    station.logoUrl && (
                        <img src={station.logoUrl}
                             alt={`Logo for station ${station.name}`}
                             decoding="async"/>
                    )
                }
                {station.name}
                <ExpandIcon isExpanded={isExpanded}/>
            </button>
            <StationMenu menuItemsByCategoryName={station.menu}/>
        </div>
    );
};