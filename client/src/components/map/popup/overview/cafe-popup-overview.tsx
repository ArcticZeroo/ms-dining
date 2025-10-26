import { useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { ICafeOverviewStation } from '@msdining/common/models/cafe';
import { getIsRecentlyAvailable, toDateString } from '@msdining/common/util/date-util';
import React, { useCallback, useMemo } from 'react';
import { DiningClient } from '../../../../api/dining.ts';
import { SelectedDateContext } from '../../../../context/time.ts';
import { useValueNotifierContext } from '../../../../hooks/events.ts';
import { ICafe } from '../../../../models/cafe.ts';
import { sortStationUniquenessInPlace } from '../../../../util/sorting.ts';
import { HourglassLoadingSpinner } from '../../../icon/hourglass-loading-spinner.tsx';
import { CafePopupOverviewStation } from './cafe-popup-overview-station.tsx';

const TARGET_STATION_MINIMUM = 3;

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

const isInterestingStation = (station: ICafeOverviewStation): boolean => {
    return station.uniqueness.isTraveling
        || station.uniqueness.recentlyAvailableItemCount > 0
        || station.uniqueness.theme != null
        || getIsRecentlyAvailable(station.uniqueness.firstAppearance);
}

export const CafePopupOverview: React.FC<ICafeMarkerOverviewProps> = ({ cafe }) => {
    const overviewState = useOverviewData(cafe);

    const overviewStations = overviewState.value;
    const isLoading = overviewStations == null && !overviewState.error;

    const stationsToShow = useMemo(
        () => {
            const allStations = overviewStations ?? [];
            const interestingStations: ICafeOverviewStation[] = [];
            const stationsWithUniqueItemsToday: ICafeOverviewStation[] = [];

            for (const station of allStations) {
                if (isInterestingStation(station)) {
                    interestingStations.push(station);
                    continue;
                }

                // In case we don't have enough interesting stations,
                // we can give some more interest to stations with unique items today.
                const uniqueItemsToday = station.uniqueness.itemDays[1] || 0;
                if (uniqueItemsToday > 0) {
                    stationsWithUniqueItemsToday.push(station);
                }
            }

            const remainingForTargetCount = TARGET_STATION_MINIMUM - interestingStations.length;

            if (remainingForTargetCount > 0 && stationsWithUniqueItemsToday.length > 0) {
                stationsWithUniqueItemsToday.sort((a, b) => {
                    const uniqueItemsA = a.uniqueness.itemDays[1] || 0;
                    const uniqueItemsB = b.uniqueness.itemDays[1] || 0;
                    return uniqueItemsB - uniqueItemsA;
                });

                interestingStations.push(...stationsWithUniqueItemsToday.slice(0, remainingForTargetCount));
            }

            sortStationUniquenessInPlace(interestingStations);

            return interestingStations;
        },
        [overviewStations]
    );

    if (!isLoading && stationsToShow.length === 0) {
        return null;
    }

    return (
        <div>
            {
                isLoading && (
                    <HourglassLoadingSpinner/>
                )
            }
            {
                !isLoading && stationsToShow.length > 0 && (
                    <div key={cafe.id} className="flex-col">
                        <span>
                            Interesting stations today:
                        </span>
                        <span className="flex-col">
                            {
                                stationsToShow.map(station => (
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