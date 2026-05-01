import { ICafeStation, MenuItemsByCategoryName } from '../../../models/cafe.ts';
import React, { useContext, useMemo } from 'react';
import { StationListEmpty } from './station-list-empty.tsx';
import { Station } from './station.tsx';
import { useValueNotifier } from '../../../hooks/events.ts';
import { getFilteredMenu } from '../../../hooks/cafe.ts';
import { ApplicationSettings, DebugSettings } from '../../../constants/settings.ts';
import { sortStationUniquenessInPlace } from '../../../util/sorting.ts';
import { CurrentCafeContext } from '../../../context/menu-item.js';
import { IIngredientsMenuDTO } from '@msdining/common/models/ingredients';
import { resolveIngredientsMenu } from '../../../util/in-gredients.js';
import { ICafeShutdownState } from '@msdining/common/models/cafe';

const useFilteredStationData = (stations: ICafeStation[], ingredientsMenu?: IIngredientsMenuDTO): Array<[ICafeStation, MenuItemsByCategoryName]> => {
    const cafe = useContext(CurrentCafeContext);
    const enableBetterIngredientsMenu = useValueNotifier(DebugSettings.ingredientsMenuExperience);
    const enablePriceFilters = useValueNotifier(ApplicationSettings.enablePriceFilters);
    const minPrice = useValueNotifier(ApplicationSettings.minimumPrice);
    const maxPrice = useValueNotifier(ApplicationSettings.maximumPrice);
    const shouldHideEveryDayStations = useValueNotifier(ApplicationSettings.hideEveryDayStations);
    const shouldDoIntelligentOrdering = useValueNotifier(ApplicationSettings.intelligentStationSort);

    return useMemo(
        () => {
            const filteredStations: Array<[ICafeStation, MenuItemsByCategoryName]> = [];

            const stationsInOrder = [];
            if (cafe.id === 'in-gredients' && enableBetterIngredientsMenu) {
                stationsInOrder.push(...resolveIngredientsMenu(ingredientsMenu, stations));
            } else {
                stationsInOrder.push(...stations);
            }

            if (shouldDoIntelligentOrdering) {
                sortStationUniquenessInPlace(stationsInOrder);
            }

            for (const station of stationsInOrder) {
                if (shouldHideEveryDayStations && station.uniqueness?.daysThisWeek === 5) {
                    continue;
                }

                let menu: MenuItemsByCategoryName | null = station.menu;
                if (enablePriceFilters) {
                    menu = getFilteredMenu(station, minPrice, maxPrice);
                }

                if (menu != null) {
                    filteredStations.push([station, menu]);
                }
            }

            return filteredStations;
        },
        [cafe.id, enableBetterIngredientsMenu, shouldDoIntelligentOrdering, ingredientsMenu, stations, shouldHideEveryDayStations, enablePriceFilters, minPrice, maxPrice]
    );
};

interface IStationListProps {
    stations: ICafeStation[];
    isAvailable: boolean;
    shutdownState?: ICafeShutdownState;
    ingredientsMenu?: IIngredientsMenuDTO;
}

const getShutDownDisplayMessage = ({ message, isTemporary, resumeInfo }: ICafeShutdownState): string => {
    const base = message || 'This cafe is temporarily closed.';
    if (isTemporary && resumeInfo) {
        return `${base} (${resumeInfo})`;
    }
    return base;
};

export const StationList: React.FC<IStationListProps> = ({ stations, isAvailable, shutdownState, ingredientsMenu }) => {
    const filteredStationData = useFilteredStationData(stations, ingredientsMenu);

    if (shutdownState != null && shutdownState.type !== 'online_ordering_only') {
        return (
            <StationListEmpty message={getShutDownDisplayMessage(shutdownState)}/>
        );
    }

    if (stations.length === 0) {
        return (
            <StationListEmpty message={isAvailable ? undefined : 'This cafe is not available today.'}/>
        );
    }

    if (filteredStationData.length === 0) {
        return (
            <StationListEmpty message="Your filters are hiding all the menu items."/>
        );
    }

    return (
        <div className="stations">
            {shutdownState != null && shutdownState.type === 'online_ordering_only' && (
                <div className="subtitle text-center">
                    ⚠️ Online ordering unavailable - {shutdownState.message}
                </div>
            )}
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