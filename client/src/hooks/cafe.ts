import { ISearchQuery, SearchEntityType } from '@msdining/common/dist/models/search';
import { normalizeNameForSearch } from '@msdining/common/dist/util/search-util';
import { useCallback, useContext, useMemo } from 'react';
import { StringSetSetting } from '../api/settings.ts';
import { getCafeLocation, getTargetSettingForFavorite } from '../util/cafe.ts';
import { useValueNotifier, useValueNotifierSetTarget } from './events.ts';
import { ICafeStation, MenuItemsByCategoryName } from '../models/cafe.ts';
import { ApplicationSettings, DebugSettings } from '../constants/settings.ts';
import { useIsTodaySelected } from './date-picker.tsx';
import { ILocationCoordinates } from '@msdining/common/dist/models/util';
import { ApplicationContext } from '../context/app.ts';
import { getDistanceBetweenCoordinates } from '../util/user-location.ts';

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
}

export const useIsPriceAllowed = () => {
    const enablePriceFilters = useValueNotifier(ApplicationSettings.enablePriceFilters);
    const minPrice = useValueNotifier(ApplicationSettings.minimumPrice);
    const maxPrice = useValueNotifier(ApplicationSettings.maximumPrice);

    return useCallback(
        (value: number) => !enablePriceFilters || (value >= minPrice && value <= maxPrice),
        [enablePriceFilters, maxPrice, minPrice]
    );
}

export const useIsOnlineOrderingAllowedForSelectedDate = () => {
    const isTodaySelected = useIsTodaySelected();
    const isOnlineOrderingEnabled = useValueNotifier(DebugSettings.allowOnlineOrdering);
    return isTodaySelected && isOnlineOrderingEnabled;
};

export const useCafesSortedByDistance = (userLocation: ILocationCoordinates | null) => {
    const { cafes } = useContext(ApplicationContext);

    return useMemo(() => {
        if (!userLocation) {
            return [];
        }

        const cafeDistancesById = new Map<string, number>();
        for (const cafe of cafes) {
            const cafeLocation = getCafeLocation(cafe);
            const distance = getDistanceBetweenCoordinates(userLocation, cafeLocation);
            cafeDistancesById.set(cafe.id, distance);
        }

        return cafes.sort((a, b) => {
            const distanceA = cafeDistancesById.get(a.id);
            const distanceB = cafeDistancesById.get(b.id);

            if (distanceA == null || distanceB == null) {
                return 0;
            }

            return distanceA - distanceB;
        });
    }, [cafes, userLocation]);
}