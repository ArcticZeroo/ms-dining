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