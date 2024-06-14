import { CafeMenu, ICafeStation, MenuItemsByCategoryName } from '../../../models/cafe.ts';
import React, { useMemo } from 'react';
import { StationListEmpty } from './station-list-empty.tsx';
import { Station } from './station.tsx';
import { useValueNotifier } from '../../../hooks/events.ts';
import { getFilteredMenu } from '../../../hooks/cafe.ts';
import { ApplicationSettings } from '../../../constants/settings.ts';
import { sortStationUniquenessInPlace } from "../../../util/sorting.ts";

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

    const filteredStationData: Array<[ICafeStation, MenuItemsByCategoryName]> = useMemo(
        () => {
            const filteredStations: Array<[ICafeStation, MenuItemsByCategoryName]> = [];

            const stationsInOrder = [...stations];
            if (shouldDoIntelligentOrdering) {
                sortStationUniquenessInPlace(stationsInOrder);
            }

            for (const station of stationsInOrder) {
                if (shouldHideEveryDayStations && station.uniqueness?.daysThisWeek === 5) {
                    continue;
                }

                let menu: MenuItemsByCategoryName | null = station.menu;
                if (enablePriceFilters) {
                    menu = getFilteredMenu(station, minPrice, maxPrice)
                }

                if (menu != null) {
                    filteredStations.push([station, menu]);
                }
            }

            return filteredStations;
        },
        [shouldDoIntelligentOrdering, stations, shouldHideEveryDayStations, enablePriceFilters, minPrice, maxPrice]
    );

    if (!isVisible) {
        return null;
    }

    if (stations.length === 0) {
        return (
            <StationListEmpty/>
        );
    }

    if (filteredStationData.length === 0) {
        return (
            <StationListEmpty message="Your filters are hiding all the menu items."/>
        );
    }

    return (
        <div className="stations">
            {
                filteredStationData.map(([station, menu]) => (
                    <Station
                        key={station.name}
                        station={station}
                        menu={menu}
                    />
                ))
            }
        </div>
    );
};