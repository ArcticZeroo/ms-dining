import { ApplicationSettings, DebugSettings, HomeSettings, InternalSettings } from '../constants/settings.ts';
import { ARRAY_DELIMITER } from '../api/settings.ts';

interface IMigrationData {
    internalSettings: {
        [K in keyof typeof InternalSettings]: string;
    };
    applicationSettings: {
        [K in keyof typeof ApplicationSettings]: string;
    };
    debugSettings: {
        [K in keyof typeof DebugSettings]: string;
    };
    homeSettings: {
        [K in keyof typeof HomeSettings]: string;
    };
}

const serializeIterableStringSetting = (value: Iterable<string>) => {
    return Array.from(value).join(ARRAY_DELIMITER);
};

export const doMigrationAndRedirectToDiningSite = () => {
    if (!InternalSettings.hasMigratedToDiningSite.value) {
        const migrationData: IMigrationData = {
            internalSettings: {
                lastUsedCafeIds: serializeIterableStringSetting(InternalSettings.lastUsedCafeIds.value),
                collapsedStations: serializeIterableStringSetting(InternalSettings.collapsedStations.value),
                visitorId: InternalSettings.visitorId.value,
                alias: InternalSettings.alias.value,
                phoneNumber: InternalSettings.phoneNumber.value,
                nameOnCard: InternalSettings.nameOnCard.value,
                postalCode: InternalSettings.postalCode.value,
                cart: JSON.stringify(InternalSettings.cart.value),
                hasMigratedToDiningSite: 'true'
            },
            applicationSettings: {
                shouldUseGroups: ApplicationSettings.shouldUseGroups.value.toString(),
                shouldCondenseNumbers: ApplicationSettings.shouldCondenseNumbers.value.toString(),
                shouldUseCompactMode: ApplicationSettings.shouldUseCompactMode.value.toString(),
                showImages: ApplicationSettings.showImages.value.toString(),
                showCalories: ApplicationSettings.showCalories.value.toString(),
                showDescriptions: ApplicationSettings.showDescriptions.value.toString(),
                showTags: ApplicationSettings.showTags.value.toString(),
                showSearchTags: ApplicationSettings.showSearchTags.value.toString(),
                showFavoritesOnHome: ApplicationSettings.showFavoritesOnHome.value.toString(),
                showPriceInSearch: ApplicationSettings.showPriceInSearch.value.toString(),
                collapseCafesByDefault: ApplicationSettings.collapseCafesByDefault.value.toString(),
                collapseStationsByDefault: ApplicationSettings.collapseStationsByDefault.value.toString(),
                allowFutureMenus: ApplicationSettings.allowFutureMenus.value.toString(),
                enablePriceFilters: ApplicationSettings.enablePriceFilters.value.toString(),
                suppressMultiCafeOrderWarning: ApplicationSettings.suppressMultiCafeOrderWarning.value.toString(),
                allowLocation: ApplicationSettings.allowLocation.value.toString(),
                hideEveryDayStations: ApplicationSettings.hideEveryDayStations.value.toString(),
                showStationOverviews: ApplicationSettings.showStationOverviews.value.toString(),
                intelligentStationSort: ApplicationSettings.intelligentStationSort.value.toString(),
                homepageViews: serializeIterableStringSetting(ApplicationSettings.homepageViews.value),
                highlightTagNames: serializeIterableStringSetting(ApplicationSettings.highlightTagNames.value),
                favoriteItemNames: serializeIterableStringSetting(ApplicationSettings.favoriteItemNames.value),
                favoriteStationNames: serializeIterableStringSetting(ApplicationSettings.favoriteStationNames.value),
                searchAllowedViewIds: serializeIterableStringSetting(ApplicationSettings.searchAllowedViewIds.value),
                minimumPrice: ApplicationSettings.minimumPrice.value.toString(),
                maximumPrice: ApplicationSettings.maximumPrice.value.toString(),
            },
            debugSettings: {
                allowOnlineOrdering: DebugSettings.allowOnlineOrdering.value.toString(),
                suppressExperimentalOnlineOrderingWarning: DebugSettings.suppressExperimentalOnlineOrderingWarning.value.toString(),
                verboseLogging: DebugSettings.verboseLogging.value.toString(),
                noVectorSearch: DebugSettings.noVectorSearch.value.toString(),
            },
            homeSettings: {
                showExploreOnHome: HomeSettings.showExploreOnHome.value.toString(),
                showMapOnHome: HomeSettings.showMapOnHome.value.toString(),
            },
        };

        const migrationDataString = JSON.stringify(migrationData);
        const encodedMigrationData = encodeURIComponent(migrationDataString);
        document.cookie = `migratedSettings=${encodedMigrationData}; domain=frozor.io; max-age=900; SameSite=Strict`;
        InternalSettings.hasMigratedToDiningSite.value = true;
    }

    const url = new URL(window.location.href);
    url.hostname = 'dining.frozor.io';
    window.location.href = url.toString();
};

const deserializeStringArraySetting = (value: string) => {
    return value.split(ARRAY_DELIMITER);
}

const deserializeStringSetSetting = (value: string) => {
    return new Set(value.split(ARRAY_DELIMITER));
}

const deserializeBooleanSetting = (value: string) => {
    return value === 'true';
}

const deserializeNumberSetting = (value: string) => {
    return Number(value);
}

export const checkMigrationCookie = () => {
    const cookie = document.cookie.split(';').find(cookie => cookie.includes('migratedSettings='));

    if (!cookie) {
        return;
    }

    const [, encodedMigrationData] = cookie.split('=');

    const migrationDataString = decodeURIComponent(encodedMigrationData);
    const migrationData = JSON.parse(migrationDataString) as IMigrationData;

    InternalSettings.lastUsedCafeIds.value = deserializeStringArraySetting(migrationData.internalSettings.lastUsedCafeIds);
    InternalSettings.collapsedStations.value = deserializeStringSetSetting(migrationData.internalSettings.collapsedStations);
    InternalSettings.visitorId.value = migrationData.internalSettings.visitorId;
    InternalSettings.alias.value = migrationData.internalSettings.alias;
    InternalSettings.phoneNumber.value = migrationData.internalSettings.phoneNumber;
    InternalSettings.nameOnCard.value = migrationData.internalSettings.nameOnCard;
    InternalSettings.postalCode.value = migrationData.internalSettings.postalCode;
    InternalSettings.cart.value = JSON.parse(migrationData.internalSettings.cart);
    InternalSettings.hasMigratedToDiningSite.value = true;

    ApplicationSettings.shouldUseGroups.value = deserializeBooleanSetting(migrationData.applicationSettings.shouldUseGroups);
    ApplicationSettings.shouldCondenseNumbers.value = deserializeBooleanSetting(migrationData.applicationSettings.shouldCondenseNumbers);
    ApplicationSettings.shouldUseCompactMode.value = deserializeBooleanSetting(migrationData.applicationSettings.shouldUseCompactMode);
    ApplicationSettings.showImages.value = deserializeBooleanSetting(migrationData.applicationSettings.showImages);
    ApplicationSettings.showCalories.value = deserializeBooleanSetting(migrationData.applicationSettings.showCalories);
    ApplicationSettings.showDescriptions.value = deserializeBooleanSetting(migrationData.applicationSettings.showDescriptions);
    ApplicationSettings.showTags.value = deserializeBooleanSetting(migrationData.applicationSettings.showTags);
    ApplicationSettings.showSearchTags.value = deserializeBooleanSetting(migrationData.applicationSettings.showSearchTags);
    ApplicationSettings.showFavoritesOnHome.value = deserializeBooleanSetting(migrationData.applicationSettings.showFavoritesOnHome);
    ApplicationSettings.showPriceInSearch.value = deserializeBooleanSetting(migrationData.applicationSettings.showPriceInSearch);
    ApplicationSettings.collapseCafesByDefault.value = deserializeBooleanSetting(migrationData.applicationSettings.collapseCafesByDefault);
    ApplicationSettings.collapseStationsByDefault.value = deserializeBooleanSetting(migrationData.applicationSettings.collapseStationsByDefault);
    ApplicationSettings.allowFutureMenus.value = deserializeBooleanSetting(migrationData.applicationSettings.allowFutureMenus);
    ApplicationSettings.enablePriceFilters.value = deserializeBooleanSetting(migrationData.applicationSettings.enablePriceFilters);
    ApplicationSettings.suppressMultiCafeOrderWarning.value = deserializeBooleanSetting(migrationData.applicationSettings.suppressMultiCafeOrderWarning);
    ApplicationSettings.allowLocation.value = deserializeBooleanSetting(migrationData.applicationSettings.allowLocation);
    ApplicationSettings.hideEveryDayStations.value = deserializeBooleanSetting(migrationData.applicationSettings.hideEveryDayStations);
    ApplicationSettings.showStationOverviews.value = deserializeBooleanSetting(migrationData.applicationSettings.showStationOverviews);
    ApplicationSettings.intelligentStationSort.value = deserializeBooleanSetting(migrationData.applicationSettings.intelligentStationSort);
    ApplicationSettings.homepageViews.value = deserializeStringSetSetting(migrationData.applicationSettings.homepageViews);
    ApplicationSettings.highlightTagNames.value = deserializeStringSetSetting(migrationData.applicationSettings.highlightTagNames);
    ApplicationSettings.favoriteItemNames.value = deserializeStringSetSetting(migrationData.applicationSettings.favoriteItemNames);
    ApplicationSettings.favoriteStationNames.value = deserializeStringSetSetting(migrationData.applicationSettings.favoriteStationNames);
    ApplicationSettings.searchAllowedViewIds.value = deserializeStringSetSetting(migrationData.applicationSettings.searchAllowedViewIds);
    ApplicationSettings.minimumPrice.value = deserializeNumberSetting(migrationData.applicationSettings.minimumPrice);
    ApplicationSettings.maximumPrice.value = deserializeNumberSetting(migrationData.applicationSettings.maximumPrice);

    DebugSettings.allowOnlineOrdering.value = deserializeBooleanSetting(migrationData.debugSettings.allowOnlineOrdering);
    DebugSettings.suppressExperimentalOnlineOrderingWarning.value = deserializeBooleanSetting(migrationData.debugSettings.suppressExperimentalOnlineOrderingWarning);
    DebugSettings.verboseLogging.value = deserializeBooleanSetting(migrationData.debugSettings.verboseLogging);
    DebugSettings.noVectorSearch.value = deserializeBooleanSetting(migrationData.debugSettings.noVectorSearch);

    HomeSettings.showExploreOnHome.value = deserializeBooleanSetting(migrationData.homeSettings.showExploreOnHome);
    HomeSettings.showMapOnHome.value = deserializeBooleanSetting(migrationData.homeSettings.showMapOnHome);

    document.cookie = 'migratedSettings=; domain=frozor.io; max-age=0; SameSite=Strict; expires=Thu, 01 Jan 1970 00:00:00 GMT';
}