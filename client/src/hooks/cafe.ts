import { ISearchQuery, SearchEntityType } from '@msdining/common/dist/models/search';
import { normalizeNameForSearch } from '@msdining/common/dist/util/search-util';
import { useCallback, useMemo } from 'react';
import { StringSetSetting } from '../api/settings.ts';
import { getTargetSettingForFavorite } from '../util/cafe.ts';
import { useValueNotifier, useValueNotifierContext } from './events.ts';
import { ICafeStation, IMenuItemsByCategoryName } from '../models/cafe.ts';
import { ApplicationSettings, DebugSettings } from '../constants/settings.ts';
import { SelectedDateContext } from '../context/time.ts';
import { isSameDate } from '@msdining/common/dist/util/date-util';

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

    const favoriteNames = useValueNotifier(targetSetting);

    const normalizedItemName = useMemo(
        () => normalizeNameForSearch(name),
        [name]
    );

    return useMemo(
        () => favoriteNames.has(normalizedItemName),
        [normalizedItemName, favoriteNames]
    );
};

export const getFilteredMenu = (station: ICafeStation, minPrice: number, maxPrice: number) => {
    const menu: IMenuItemsByCategoryName = {};

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
    const selectedDate = useValueNotifierContext(SelectedDateContext);
    const isOnlineOrderingEnabled = useValueNotifier(DebugSettings.allowOnlineOrdering);

    return useMemo(
        () => isOnlineOrderingEnabled && isSameDate(new Date(), selectedDate),
        [isOnlineOrderingEnabled, selectedDate]
    );
};