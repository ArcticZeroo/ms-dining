import { CafeMenu, ICafeStation, IMenuItemsByCategoryName } from '../../../models/cafe.ts';
import React, { useMemo } from 'react';
import { CollapsibleStation } from './collapsible-station.tsx';
import { classNames } from '../../../util/react.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { getFilteredMenu } from '../../../hooks/cafe.ts';
import { ApplicationSettings } from '../../../constants/settings.ts';

interface IStationListProps {
    stations: CafeMenu;
    isVisible: boolean;
}

export const StationList: React.FC<IStationListProps> = ({ stations, isVisible }) => {
    const enablePriceFilters = useValueNotifier(ApplicationSettings.enablePriceFilters);
    const minPrice = useValueNotifier(ApplicationSettings.minimumPrice);
    const maxPrice = useValueNotifier(ApplicationSettings.maximumPrice);
    const shouldHideEveryDayStations = useValueNotifier(ApplicationSettings.hideEveryDayStations);
    const shouldDoIntelligentOrdering = useValueNotifier(ApplicationSettings.intelligentStationSort);

    const filteredStationData: Array<[ICafeStation, IMenuItemsByCategoryName]> = useMemo(
        () => {
            const filteredStations: Array<[ICafeStation, IMenuItemsByCategoryName]> = [];

            for (const station of stations) {
                if (shouldHideEveryDayStations && station.uniqueness?.daysThisWeek === 5) {
                    continue;
                }

                let menu: IMenuItemsByCategoryName | null = station.menu;

                if (enablePriceFilters) {
                    menu = getFilteredMenu(station, minPrice, maxPrice)
                    continue;
                }

                if (menu != null) {
                    filteredStations.push([station, menu]);
                }
            }

            if (shouldDoIntelligentOrdering) {
                filteredStations.sort(([stationA], [stationB]) => {
                    const uniquenessA = stationA.uniqueness;
                    const uniquenessB = stationB.uniqueness;

                    if (uniquenessA.daysThisWeek !== uniquenessB.daysThisWeek) {
                        // Stations which are rarer should be first.
                        return uniquenessA.daysThisWeek - uniquenessB.daysThisWeek;
                    }

                    // Stations with more unique items should be first.
                    for (let i = 1; i <= 5; i++) {
                        const uniqueItemsA = uniquenessA.itemDays[i] || 0;
                        const uniqueItemsB = uniquenessB.itemDays[i] || 0;

                        if (uniqueItemsA !== uniqueItemsB) {
                            return uniqueItemsB - uniqueItemsA;
                        }
                    }
                    
                    return stationA.name.localeCompare(stationB.name);
                });
            }

            return filteredStations;
        },
        [shouldDoIntelligentOrdering, stations, shouldHideEveryDayStations, enablePriceFilters, minPrice, maxPrice]
    );

    const emptyMessage = useMemo(() => {
        if (stations.length === 0) {
            return `There's nothing here! This cafe is probably closed during this time.`;
        }

        if (filteredStationData.length === 0) {
            return `There's nothing here! Your filters are hiding all the menu items.`;
        }
    }, [filteredStationData, stations]);

    return (
        <div className={classNames('stations', !isVisible && 'hidden')}>
            { emptyMessage }
            {
                filteredStationData.map(([station, menu]) => (
                    <CollapsibleStation
                        key={station.name}
                        station={station}
                        menu={menu}
                    />
                ))
            }
        </div>
    );
};