import { ICafeOverviewStation } from '@msdining/common/dist/models/cafe';
import React from 'react';

interface ICafePopupOverviewStationProps {
    station: ICafeOverviewStation;
}

export const CafePopupOverviewStation: React.FC<ICafePopupOverviewStationProps> = ({ station }) => station.uniqueness.isTraveling && (
    <div className="flex overview-station">
        {
            station.logoUrl && (
                <img
                    src={station.logoUrl}
                    alt={`${station.name} logo`}
                    className="station-logo"
                />
            )
        }
        {station.name}
    </div>
)