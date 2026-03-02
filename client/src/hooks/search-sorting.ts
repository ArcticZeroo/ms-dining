import { useContext, useMemo } from 'react';
import { ApplicationContext } from '../context/app.ts';
import { useValueNotifier } from './events.ts';
import { ISearchResultSortingContext } from '../util/search-sorting.ts';
import { PassiveUserLocationNotifier, PromptingUserLocationNotifier } from '../api/location/user-location.ts';
import { ApplicationSettings } from '../constants/settings.ts';
import { sortCafesInPriorityOrder } from '../util/sorting.ts';

export const useSortContext = (queryText: string, shouldPromptUserForLocation: boolean): ISearchResultSortingContext => {
    const { cafes, viewsById } = useContext(ApplicationContext);

    const targetLocationProvider = shouldPromptUserForLocation
        ? PromptingUserLocationNotifier
        : PassiveUserLocationNotifier;
    const userLocation = useValueNotifier(targetLocationProvider);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);
    const homepageViewIds = useValueNotifier(ApplicationSettings.homepageViews);
    const favoriteItemNames = useValueNotifier(ApplicationSettings.favoriteItemNames);
    const favoriteStationNames = useValueNotifier(ApplicationSettings.favoriteStationNames);

    const cafePriorityOrder = useMemo(() => sortCafesInPriorityOrder(cafes, viewsById), [cafes, viewsById]);

    return useMemo(() => {
        return {
            queryText,
            viewsById,
            userLocation,
            homepageViewIds,
            favoriteItemNames,
            favoriteStationNames,
            isUsingGroups: shouldUseGroups,
            cafePriorityOrder: cafePriorityOrder.map(cafe => cafe.id),
        };
    }, [cafePriorityOrder, favoriteItemNames, favoriteStationNames, homepageViewIds, queryText, shouldUseGroups, userLocation, viewsById]);
}
