import { ISearchQuery, SearchEntityType } from '@msdining/common/models/search';
import { ILocationCoordinates } from '@msdining/common/models/util';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import { useCallback, useMemo } from 'react';
import { StringSetSetting } from '../api/settings.ts';
import { ApplicationSettings, DebugSettings } from '../constants/settings.ts';
import { ICafeStation, MenuItemsByCategoryName } from '../models/cafe.ts';
import { getTargetSettingForFavorite } from '../util/cafe.ts';
import { getDistanceBetweenCoordinates } from '../util/coordinates.ts';
import { getViewLocation } from '../util/view.ts';
import { useIsTodaySelected } from './date-picker.tsx';
import { useValueNotifier, useValueNotifierSetTarget } from './events.ts';
import { useViewsForNav } from './views.ts';

const useQueries = (setting: StringSetSetting, type: SearchEntityType) => {
    const names = useValueNotifier(setting);
    return useMemo(() => {
        const queries: ISearchQuery[] = [];

        for (const name of names) {
            queries.push({
                text: name,
                type
            });
        }

        return queries;
    }, [names, type]);
};

export const useFavoriteQueries = () => {
    return [
        ...useQueries(ApplicationSettings.favoriteItemNames, SearchEntityType.menuItem),
        ...useQueries(ApplicationSettings.favoriteStationNames, SearchEntityType.station),
    ];
};

export const useIsFavoriteItem = (name: string, type: SearchEntityType) => {
    const targetSetting = getTargetSettingForFavorite(type);

    const normalizedItemName = useMemo(
        () => normalizeNameForSearch(name),
        [name]
    );

    return useValueNotifierSetTarget(targetSetting, normalizedItemName);
};

export const getFilteredMenu = (station: ICafeStation, minPrice: number, maxPrice: number) => {
    const menu: MenuItemsByCategoryName = {};

    for (const [categoryName, items] of Object.entries(station.menu)) {
        const filteredItems = items.filter(item => {
            return item.price >= minPrice && item.price <= maxPrice;
        });

        if (filteredItems.length > 0) {
            menu[categoryName] = filteredItems;
        }
    }

    if (Object.keys(menu).length === 0) {
        return null;
    }

    return menu;
};

export const useIsPriceAllowed = () => {
    const enablePriceFilters = useValueNotifier(ApplicationSettings.enablePriceFilters);
    const minPrice = useValueNotifier(ApplicationSettings.minimumPrice);
    const maxPrice = useValueNotifier(ApplicationSettings.maximumPrice);

    return useCallback(
        (value: number) => !enablePriceFilters || (value >= minPrice && value <= maxPrice),
        [enablePriceFilters, maxPrice, minPrice]
    );
};

export const useIsOnlineOrderingAllowedForSelectedDate = () => {
    const isTodaySelected = useIsTodaySelected();
    const isOnlineOrderingEnabled = useValueNotifier(DebugSettings.allowOnlineOrdering);
    return isTodaySelected && isOnlineOrderingEnabled;
};

export const useViewsSortedByDistance = (locations: ILocationCoordinates[]) => {
    const views = useViewsForNav();

    return useMemo(() => {
        if (locations.length === 0) {
            return [];
        }

        const minDistancesById = new Map<string, number>();
        for (const view of views) {
            for (const location of locations) {
                const viewLocation = getViewLocation(view);

                const distance = getDistanceBetweenCoordinates(viewLocation, location);
                const existingDistance = minDistancesById.get(view.value.id) ?? Number.MAX_SAFE_INTEGER;

                minDistancesById.set(view.value.id, Math.min(existingDistance, distance));
            }
        }

        return [...views].sort((a, b) => {
            const distanceA = minDistancesById.get(a.value.id);
            const distanceB = minDistancesById.get(b.value.id);

            if (distanceA == null || distanceB == null) {
                return 0;
            }

            return distanceA - distanceB;
        });
    }, [locations, views]);
};