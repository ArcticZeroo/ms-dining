import { useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { toDateString } from '@msdining/common/dist/util/date-util';
import React, { useCallback, useMemo } from 'react';
import { DiningClient } from '../../../../api/dining.ts';
import { SelectedDateContext } from '../../../../context/time.ts';
import { useValueNotifierContext } from '../../../../hooks/events.ts';
import { ICafe } from '../../../../models/cafe.ts';
import { HourglassLoadingSpinner } from '../../../icon/hourglass-loading-spinner.tsx';
import { CafePopupOverviewStation } from './cafe-popup-overview-station.tsx';

const useOverviewData = (cafe: ICafe) => {
    const selectedDate = useValueNotifierContext(SelectedDateContext);

    const selectedDateString = useMemo(
        () => toDateString(selectedDate),
        [selectedDate]
    );

    const retrieveOverviews = useCallback(
        () => DiningClient.retrieveCafeMenuOverview(cafe, selectedDateString),
        [cafe, selectedDateString]
    );

    return useImmediatePromiseState(retrieveOverviews);
};

interface ICafeMarkerOverviewProps {
    cafe: ICafe;
}

export const CafePopupOverview: React.FC<ICafeMarkerOverviewProps> = ({ cafe }) => {
    const overviewState = useOverviewData(cafe);

    const overviewStations = overviewState.value;
    const travelingStationCount = overviewStations?.filter(station => station.uniqueness.isTraveling)?.length ?? 0;

    if (overviewStations != null && travelingStationCount === 0) {
        return null;
    }

    return (
        <div>
            {
                overviewStations == null && (
                    <HourglassLoadingSpinner/>
                )
            }
            {
                overviewStations != null && travelingStationCount > 0 && (
                    <div key={cafe.id} className="flex-col">
                        <span>
                            Traveling stations today:
                        </span>
                        <span className="flex-col">
                            {
                                overviewStations.map(station => (
                                    <CafePopupOverviewStation
                                        key={station.name}
                                        cafe={cafe}
                                        station={station}
                                    />
                                ))
                            }
                        </span>
                    </div>
                )
            }
        </div>
    );
};