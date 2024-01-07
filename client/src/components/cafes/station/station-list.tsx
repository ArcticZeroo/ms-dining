import { CafeMenu, ICafeStation, IMenuItemsByCategoryName } from '../../../models/cafe.ts';
import React, { useMemo } from 'react';
import { CollapsibleStation } from './collapsible-station.tsx';
import { classNames } from '../../../util/react.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { ApplicationSettings } from '../../../api/settings.ts';
import { getFilteredMenu } from '../../../hooks/cafe.ts';

interface IStationListProps {
    stations: CafeMenu;
    isVisible: boolean;
}

export const StationList: React.FC<IStationListProps> = ({ stations, isVisible }) => {
    const enablePriceFilters = useValueNotifier(ApplicationSettings.enablePriceFilters);
    const minPrice = useValueNotifier(ApplicationSettings.minimumPrice);
    const maxPrice = useValueNotifier(ApplicationSettings.maximumPrice);

    const filteredStationData: Array<[ICafeStation, IMenuItemsByCategoryName]> = useMemo(
        () => {
            const filteredStations: Array<[ICafeStation, IMenuItemsByCategoryName]> = [];

            for (const station of stations) {
                if (!enablePriceFilters) {
                    filteredStations.push([station, station.menu]);
                    continue;
                }

                const filteredMenu = getFilteredMenu(station, minPrice, maxPrice);

                if (filteredMenu != null) {
                    filteredStations.push([station, filteredMenu]);
                }
            }

            return filteredStations;
        },
        [stations, enablePriceFilters, minPrice, maxPrice]
    );

    return (
        <div className={classNames('stations', !isVisible && 'hidden')}>
            {
                filteredStationData.length === 0
                && 'There\'s nothing here! This cafe is probably closed during this time, or you have a filter enabled that is hiding all the stations.'
            }
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