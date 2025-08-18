import { IDiningCoreResponse } from '@msdining/common/dist/models/http.ts';
import { ApplicationSettings, InternalSettings } from '../constants/settings.ts';
import { DiningClient } from '../api/dining.ts';
import { isSameSet } from './set.ts';

export const updateRoamingSettingsOnBoot = (user: IDiningCoreResponse['user']) => {
    if (user == null) {
        return;
    }

    const roamingSettings = user.settings;

    let serverNeedsUpdate = roamingSettings == null;

    if (roamingSettings != null) {
        console.log('server has roaming settings', roamingSettings);

        if (Number.isNaN(InternalSettings.lastRoamingSettingsUpdateTime.value.getTime()) || roamingSettings.lastUpdate === 0) {
            // Another client has updated settings on the service but this client never has.
            // We should merge so that this client doesn't lose data.
            console.log('server has roaming settings but client does not, merging');

            const initialFavoriteMenuItemsCount = ApplicationSettings.favoriteItemNames.value.size;
            const initialFavoriteStationCount = ApplicationSettings.favoriteStationNames.value.size;
            const initialHomepageIdsCount = ApplicationSettings.homepageViews.value.size;

            ApplicationSettings.favoriteItemNames.add(...roamingSettings.favoriteMenuItems);
            ApplicationSettings.favoriteStationNames.add(...roamingSettings.favoriteStations);
            ApplicationSettings.homepageViews.add(...roamingSettings.homepageIds);

            serverNeedsUpdate = initialFavoriteMenuItemsCount !== ApplicationSettings.favoriteItemNames.value.size
                || initialFavoriteStationCount !== ApplicationSettings.favoriteStationNames.value.size
                || initialHomepageIdsCount !== ApplicationSettings.homepageViews.value.size;
        } else if (InternalSettings.lastRoamingSettingsUpdateTime.value.getTime() < roamingSettings.lastUpdate) {
            // Otherwise, we want to be able to respect removals across clients. Last writer wins.
            console.log('server has roaming settings but client has is out of date, using server settings');

            const newFavoriteMenuItems = new Set(roamingSettings.favoriteMenuItems);
            const newFavoriteStations = new Set(roamingSettings.favoriteStations);
            const newHomepageIds = new Set(roamingSettings.homepageIds);

            serverNeedsUpdate = !isSameSet(ApplicationSettings.favoriteItemNames.value, newFavoriteMenuItems)
                || !isSameSet(ApplicationSettings.favoriteStationNames.value, newFavoriteStations)
                || !isSameSet(ApplicationSettings.homepageViews.value, newHomepageIds);

            ApplicationSettings.favoriteItemNames.value = newFavoriteMenuItems;
            ApplicationSettings.favoriteStationNames.value = newFavoriteStations;
            ApplicationSettings.homepageViews.value = newHomepageIds;
        }
    }

    if (serverNeedsUpdate) {
        console.log('server needs update, updating roaming settings');
        DiningClient.updateSettings({
            favoriteMenuItems: Array.from(ApplicationSettings.favoriteItemNames.value),
            favoriteStations:  Array.from(ApplicationSettings.favoriteStationNames.value),
            homepageIds:       Array.from(ApplicationSettings.homepageViews.value)
        }).then(() => {
            console.log('Updated roaming settings in server on boot');
        }).catch(err => {
            console.log('Failed to update roaming settings on boot:', err);
        });
    } else {
        console.log('Roaming settings are already up to date, no update needed');
    }
};
