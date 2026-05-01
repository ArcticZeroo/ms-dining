import { ICafeOverviewStation, ICafeShutdownState } from '@msdining/common/models/cafe';
import React, { useMemo } from 'react';
import { sortStationUniquenessInPlace } from '../../util/sorting.js';
import { getIsRecentlyAvailable } from '@msdining/common/util/date-util';
import { CafePopupOverviewStation } from '../map/popup/overview/cafe-popup-overview-station.js';
import { ICafe } from '../../models/cafe.js';
import './menu-overview.css';
import { useSelectedDisplayDateString } from '../../hooks/date-picker.js';

const TARGET_STATION_MINIMUM = 3;

const isInterestingStation = (station: ICafeOverviewStation): boolean => {
    return station.uniqueness.isTraveling
        || station.uniqueness.recentlyAvailableItemCount > 0
        || station.uniqueness.theme != null
        || getIsRecentlyAvailable(station.uniqueness.firstAppearance);
}

interface ICafeOverviewWithDataProps {
    cafe: ICafe;
    overviewStations: ICafeOverviewStation[];
    shutDownState?: ICafeShutdownState;
    showAllStationsIfNoneInteresting?: boolean;
    showAllStations?: boolean;
}

export const CafeOverviewWithData: React.FC<ICafeOverviewWithDataProps> = ({ cafe, overviewStations, shutDownState, showAllStationsIfNoneInteresting = false, showAllStations = false }) => {
    const dateString = useSelectedDisplayDateString();

    const interestingStations = useMemo(
        () => {
            const allStations = overviewStations ?? [];

            if (showAllStations) {
                const sorted = [...allStations];
                sortStationUniquenessInPlace(sorted);
                return sorted;
            }

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
        [overviewStations, showAllStations]
    );

    if (shutDownState) {
        if (shutDownState.type !== 'online_ordering_only') {
            return (
                <div className="flex-col">
                    <span>⚠️ This location is {shutDownState.isTemporary && 'temporarily '}closed.</span>
                    {shutDownState.message && <span className="subtitle">{shutDownState.message}</span>}
                    {shutDownState.isTemporary && shutDownState.resumeInfo && (
                        <span className="subtitle">{shutDownState.resumeInfo}</span>
                    )}
                </div>
            );
        }
    }

    if (overviewStations.length === 0) {
        return <div className="flex-col">
            <span>
                No menu available for {dateString}.
            </span>
        </div>;
    }

    if (interestingStations.length === 0 && !showAllStationsIfNoneInteresting && !showAllStations) {
        return null;
    }

    const title = showAllStations
        ? `Stations on ${dateString}:`
        : interestingStations.length > 0
            ? `Interesting stations on ${dateString}:`
            : `No new or rotating items on ${dateString}. Here's all available stations:`;

    const targetStations = interestingStations.length > 0
        ? interestingStations
        : overviewStations;

    return <div className="flex-col">
        {shutDownState?.type === 'online_ordering_only' && (
            <span className="subtitle">
                ⚠️ Online ordering unavailable - {shutDownState.message}
            </span>
        )}
        <span>
            {title}
        </span>
        <span className="flex-col">
            {
                targetStations.map(station => <CafePopupOverviewStation
                    key={station.name}
                    cafe={cafe}
                    station={station}
                />)
            }
        </span>
    </div>;
}