import { DateUtil } from '@msdining/common';
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
import { useIsLoggedIn } from './auth.ts';
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
    const itemNameQueries = useQueries(ApplicationSettings.favoriteItemNames, SearchEntityType.menuItem);
    const stationNameQueries = useQueries(ApplicationSettings.favoriteStationNames, SearchEntityType.station);

    return useMemo(() => [
        ...itemNameQueries,
        ...stationNameQueries
    ], [itemNameQueries, stationNameQueries]);
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

export type OnlineOrderingBlockedReason = 'setting-disabled' | 'weekend' | 'today-not-selected' | 'not-logged-in';

/**
 * Discriminated description of whether online ordering is currently usable
 * end-to-end. When `allowed` is false, `reason` tells consumers WHY so
 * notices can be contextual.
 *
 * Reasons:
 *  - 'setting-disabled': debug-flag is off (the default; ordering is an
 *    experimental opt-in feature).
 *  - 'weekend': the server has no menu for today's calendar date because
 *    today is Saturday/Sunday. Hydration would fail and the server-side
 *    order-prepare endpoint can't price anything.
 *  - 'today-not-selected': the user is browsing a future/past menu via the
 *    date picker. Ordering targets the current calendar day's menu only.
 */
export type IOnlineOrderingState =
    | { allowed: true }
    | { allowed: false; reason: OnlineOrderingBlockedReason };

export const useOnlineOrderingState = (): IOnlineOrderingState => {
    const isOnlineOrderingEnabled = useValueNotifier(DebugSettings.allowOnlineOrdering);
    const isTodaySelected = useIsTodaySelected();
    const isLoggedIn = useIsLoggedIn();

    if (!isOnlineOrderingEnabled) {
        return { allowed: false, reason: 'setting-disabled' };
    }

    if (!isLoggedIn) {
        return { allowed: false, reason: 'not-logged-in' };
    }

    if (DateUtil.isDateOnWeekend(new Date())) {
        return { allowed: false, reason: 'weekend' };
    }

    if (!isTodaySelected) {
        return { allowed: false, reason: 'today-not-selected' };
    }

    return { allowed: true };
};

export const useIsOnlineOrderingAllowed = (): boolean => useOnlineOrderingState().allowed;

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