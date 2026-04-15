import React from 'react';
import { ICafe } from '../../../../models/cafe.ts';
import { HourglassLoadingSpinner } from '../../../icon/hourglass-loading-spinner.tsx';
import { CafeOverviewWithData } from '../../../cafes/cafe-overview-with-data.js';
import { ICafeOverviewStation, ICafeShutDownState } from '@msdining/common/models/cafe';

interface ICafeOverviewProps {
    cafe: ICafe;
    stations: Array<ICafeOverviewStation> | undefined;
    shutDownState?: ICafeShutDownState;
    showMessageForNoStations?: boolean;
    showAllStations?: boolean;
}

export const CafeOverview: React.FC<ICafeOverviewProps> = ({ cafe, stations, shutDownState, showMessageForNoStations = false, showAllStations = false }) => {
    if (shutDownState || stations) {
        return (
            <CafeOverviewWithData
                cafe={cafe}
                overviewStations={stations ?? []}
                shutDownState={shutDownState}
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