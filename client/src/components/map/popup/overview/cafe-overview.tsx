import React from 'react';
import { ICafe } from '../../../../models/cafe.ts';
import { HourglassLoadingSpinner } from '../../../icon/hourglass-loading-spinner.tsx';
import { CafeOverviewWithData } from '../../../cafes/cafe-overview-with-data.js';
import { ICafeOverviewStation } from '@msdining/common/models/cafe';

interface ICafeOverviewProps {
    cafe: ICafe;
    stations: Array<ICafeOverviewStation> | undefined;
    showMessageForNoStations?: boolean;
    showAllStations?: boolean;
}

export const CafeOverview: React.FC<ICafeOverviewProps> = ({ cafe, stations, showMessageForNoStations = false, showAllStations = false }) => {
    if (stations) {
        return (
            <CafeOverviewWithData
                cafe={cafe}
                overviewStations={stations}
                showAllStationsIfNoneInteresting={showMessageForNoStations}
                showAllStations={showAllStations}
            />
        );
    }

    return (
        <div>
            <HourglassLoadingSpinner/>
        </div>
    );
};