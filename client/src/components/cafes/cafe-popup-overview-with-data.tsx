import { ICafeOverviewStation } from '@msdining/common/models/cafe';
import React, { useMemo } from 'react';
import { sortStationUniquenessInPlace } from '../../util/sorting.js';
import { getIsRecentlyAvailable } from '@msdining/common/util/date-util';
import { CafePopupOverviewStation } from '../map/popup/overview/cafe-popup-overview-station.js';
import { ICafe } from '../../models/cafe.js';
import './menu-overview.css';

const TARGET_STATION_MINIMUM = 3;

const isInterestingStation = (station: ICafeOverviewStation): boolean => {
    return station.uniqueness.isTraveling
        || station.uniqueness.recentlyAvailableItemCount > 0
        || station.uniqueness.theme != null
        || getIsRecentlyAvailable(station.uniqueness.firstAppearance);
}

interface ICafePopupOverviewWithDataProps {
    cafe: ICafe;
    overviewStations: ICafeOverviewStation[];
    showAllStationsIfNoneInteresting?: boolean;
}

export const CafePopupOverviewWithData: React.FC<ICafePopupOverviewWithDataProps> = ({ cafe, overviewStations, showAllStationsIfNoneInteresting = false }) => {
    const interestingStations = useMemo(
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

    if (interestingStations.length === 0 && !showAllStationsIfNoneInteresting) {
        return null;
    }

    const title = interestingStations.length > 0
        ? 'Interesting stations today:'
        : 'No new or rotating items today. Here\'s all available stations:';

    const targetStations = interestingStations.length > 0
        ? interestingStations
        : overviewStations;

    return (
        interestingStations.length > 0 && (
            <div className="flex-col">
                <span>
                    {title}
                </span>
                <span className="flex-col">
                    {
                        targetStations.map(station => (
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
    );
}