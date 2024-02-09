import { randomUserId } from '../util/random.ts';
import { BooleanSetting, NumberSetting, StringArraySetting, StringSetSetting, StringSetting } from '../api/settings.ts';

export const InternalSettings = {
    lastUsedCafeIds:               new StringArraySetting('lastUsedDiningHalls'),
    collapsedStations:             new StringSetSetting('collapsedStations'),
    visitorId:                     new StringSetting('visitorId'),
    alias:                         new StringSetting('alias'),
    phoneNumber:                   new StringSetting('phoneNumber'),
    nameOnCard:                    new StringSetting('nameOnCard'),
    postalCode:                    new StringSetting('postalCode'),
} as const;

export const ApplicationSettings = {
    shouldUseGroups:               new BooleanSetting('shouldUseGroups', true /*defaultValue*/),
    shouldCondenseNumbers:         new BooleanSetting('shouldCondenseNumbers', true /*defaultValue*/),
    showImages:                    new BooleanSetting('showImages', true /*defaultValue*/),
    showCalories:                  new BooleanSetting('showCalories', true /*defaultValue*/),
    showDescriptions:              new BooleanSetting('showDescription', true /*defaultValue*/),
    showTags:                      new BooleanSetting('showTags', true /*defaultValue*/),
    showFavoritesOnHome:           new BooleanSetting('showFavoritesOnHome', true /*defaultValue*/),
    collapseCafesByDefault:        new BooleanSetting('collapseCafesByDefault', false /*defaultValue*/),
    collapseStationsByDefault:     new BooleanSetting('collapseStationsByDefault', false /*defaultValue*/),
    allowFutureMenus:              new BooleanSetting('allowFutureMenus', false /*defaultValue*/),
    enablePriceFilters:            new BooleanSetting('enablePriceFilters', false /*defaultValue*/),
    suppressMultiCafeOrderWarning: new BooleanSetting('suppressMultiCafeOrderWarning', false /*defaultValue*/),
    allowLocation:                 new BooleanSetting('allowLocation', true /*defaultValue*/),
    hideEveryDayStations:          new BooleanSetting('hideEveryDayStations', false /*defaultValue*/),
    intelligentStationSort:        new BooleanSetting('intelligentStationSort', true /*defaultValue*/),
    homepageViews:                 new StringSetSetting('homepageDiningHalls'),
    highlightTagNames:             new StringSetSetting('highlightTagNames'),
    favoriteItemNames:             new StringSetSetting('favoriteItemNames'),
    favoriteStationNames:          new StringSetSetting('favoriteStationNames'),
    minimumPrice:                  new NumberSetting('minimumPrice', 0),
    maximumPrice:                  new NumberSetting('maximumPrice', 10),
} as const;

export const DebugSettings = {
    allowOnlineOrdering:                       new BooleanSetting('PROBABLY_BROKEN_ONLINE_ORDERING_DO_NOT_USE', false /*defaultValue*/),
    suppressExperimentalOnlineOrderingWarning: new BooleanSetting('SUPPRESS_EXPERIMENTAL_ONLINE_ORDERING_WARNING_DO_NOT_USE', false /*defaultValue*/),
    verboseLogging:                            new BooleanSetting('verboseLogging', false /*defaultValue*/),
} as const;

export const getVisitorId = () => {
    const visitorId = InternalSettings.visitorId.value;
    if (visitorId.length === 0) {
        const newVisitorId = randomUserId();
        InternalSettings.visitorId.value = newVisitorId;
        return newVisitorId;
    }
    return visitorId;
};