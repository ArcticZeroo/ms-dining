import { DateUtil, SearchTypes } from '@msdining/common';
import { normalizeCafeId } from '@msdining/common/util/cafe-util';
import { isSameDate } from '@msdining/common/util/date-util';
import { useContext, useMemo } from 'react';
import type { ISearchResultField } from '../models/search.ts';
import { ApplicationSettings } from '../constants/settings.ts';
import { ApplicationContext } from '../context/app.ts';
import { CafeView, CafeViewType } from '../models/cafe.ts';
import { useMenuItemOrderCount } from '../store/queries/ordering.ts';
import { useSelectedDate } from '../store/zustand/selected-date.ts';
import { formatOrderCount } from '../util/order.js';
import { compareNormalizedCafeIds, compareViewNames } from '../util/sorting.ts';
import { getParentView } from '../util/view.ts';
import { useIsFavoriteItem } from './cafe.ts';
import { useValueNotifier } from './events.ts';

const getLocationEntries = (
    locationDatesByCafeId: Map<string, Date[]>,
    onlyShowLocationsOnDate: Date | undefined
): Array<[string, Array<Date>]> => {
    const locationEntries = Array.from(locationDatesByCafeId.entries());

    if (!onlyShowLocationsOnDate) {
        return locationEntries;
    }

    const resultEntries: Array<[string, Array<Date>]> = [];
    for (const [cafeId, dates] of locationEntries) {
        const filteredDates = dates.filter(date => DateUtil.isSameDate(date, onlyShowLocationsOnDate));
        if (filteredDates.length > 0) {
            resultEntries.push([cafeId, filteredDates]);
        }
    }

    return resultEntries;
};

const cleanModifierDescription = (description: string) => {
    if (description.endsWith(':')) {
        return description.slice(0, description.length - 1);
    }

    return description;
};

const getMatchedModifierValue = (modifierDescription: string, choiceDescriptions: Set<string>) => {
    const cleanedDescription = cleanModifierDescription(modifierDescription);

    if (choiceDescriptions.size === 0) {
        return cleanedDescription;
    }

    return `${cleanedDescription}: ${Array.from(choiceDescriptions).join(', ')}`;
};

const getMatchedModifierFields = (matchedModifiers: Map<string, Set<string>>): ISearchResultField[] => {
    return Array.from(matchedModifiers).map(([modifierDescription, choiceDescriptions]) => ({
        iconName: 'list',
        value:    getMatchedModifierValue(modifierDescription, choiceDescriptions),
        key:      modifierDescription,
    }));
};

interface IUseLocationEntriesParams {
    viewsById: Map<string, CafeView>;
    locationDatesByCafeId: Map<string, Date[]>;
    onlyShowLocationsOnDate?: Date;
}

const useLocationEntries = ({
    viewsById,
    locationDatesByCafeId,
    onlyShowLocationsOnDate
}: IUseLocationEntriesParams): Array<[string, Array<Date>]> => {
    return useMemo(
        () => {
            const locationEntries = getLocationEntries(locationDatesByCafeId, onlyShowLocationsOnDate);

            if (onlyShowLocationsOnDate != null) {
                return locationEntries.sort(([cafeA], [cafeB]) => {
                    const viewA = viewsById.get(cafeA);
                    const viewB = viewsById.get(cafeB);

                    if (!viewA || !viewB) {
                        console.error('Cannot sort views due to missing entry in map');
                        return 0;
                    }

                    return compareViewNames(viewA.value.name, viewB.value.name);
                });
            }

            return locationEntries.sort(([cafeA, datesA], [cafeB, datesB]) => {
                const firstDateA = datesA[0];
                const firstDateB = datesB[0];

                if (!firstDateA || !firstDateB) {
                    throw new Error('Cannot sort views due to missing dates');
                }

                if (DateUtil.isDateBefore(firstDateA, firstDateB)) {
                    return -1;
                }

                if (DateUtil.isDateAfter(firstDateA, firstDateB)) {
                    return 1;
                }

                // The more "limited time only" locations get to go first
                const lastDateA = datesA[datesA.length - 1]!;
                const lastDateB = datesB[datesB.length - 1]!;

                if (DateUtil.isDateBefore(lastDateA, lastDateB)) {
                    return -1;
                }

                if (DateUtil.isDateAfter(lastDateA, lastDateB)) {
                    return 1;
                }

                const viewA = viewsById.get(cafeA);
                const viewB = viewsById.get(cafeB);

                if (!viewA || !viewB) {
                    return compareNormalizedCafeIds(normalizeCafeId(cafeA), normalizeCafeId(cafeB));
                } else {
                    return compareViewNames(viewA.value.name, viewB.value.name);
                }
            });
        },
        [locationDatesByCafeId, onlyShowLocationsOnDate, viewsById]
    );
};

const getResolvedLocationDate = (
    onlyShowLocationsOnDate: Date | undefined,
    allowFutureMenus: boolean,
    selectedDate: Date
) => {
    if (onlyShowLocationsOnDate == null && !allowFutureMenus) {
        return selectedDate;
    }

    return onlyShowLocationsOnDate;
};

const getShouldShowLocationDates = (
    onlyShowLocationsOnDate: Date | undefined,
    allowFutureMenus: boolean,
    selectedDate: Date
) => {
    if (onlyShowLocationsOnDate != null) {
        return !isSameDate(selectedDate, onlyShowLocationsOnDate);
    }

    return allowFutureMenus;
};

const getResolvedCafeDescription = (
    description: string | undefined,
    entityType: SearchTypes.SearchEntityType,
    entityView: CafeView | undefined
) => {
    if (
        entityType === SearchTypes.SearchEntityType.cafe
        && entityView
        && !description
        && entityView.type === CafeViewType.single
        && entityView.value.group
        && !entityView.value.group.alwaysExpand
        && entityView.value.name !== entityView.value.group.name
    ) {
        return entityView.value.group.name;
    }

    return description;
};

interface IUseSearchResultLocationStateParams {
    locationDatesByCafeId: Map<string, Date[]>;
    onlyShowLocationsOnDate?: Date;
}

export const useSearchResultLocationState = ({
    locationDatesByCafeId,
    onlyShowLocationsOnDate,
}: IUseSearchResultLocationStateParams) => {
    const { viewsById } = useContext(ApplicationContext);
    const allowFutureMenus = useValueNotifier(ApplicationSettings.allowFutureMenus);
    const selectedDate = useSelectedDate();

    const resolvedOnlyShowLocationsOnDate = getResolvedLocationDate(
        onlyShowLocationsOnDate,
        allowFutureMenus,
        selectedDate
    );
    const shouldShowLocationDates = getShouldShowLocationDates(
        onlyShowLocationsOnDate,
        allowFutureMenus,
        selectedDate
    );
    const locationEntriesInOrder = useLocationEntries({
        viewsById,
        locationDatesByCafeId,
        onlyShowLocationsOnDate: resolvedOnlyShowLocationsOnDate,
    });

    return {
        locationEntriesInOrder,
        resolvedOnlyShowLocationsOnDate,
        shouldShowLocationDates,
    };
};

interface IUseSearchResultCafeDetailsParams {
    cafeId?: string;
    description?: string;
    entityType: SearchTypes.SearchEntityType;
}

export const useSearchResultCafeDetails = ({
    cafeId,
    description,
    entityType,
}: IUseSearchResultCafeDetailsParams) => {
    const { viewsById } = useContext(ApplicationContext);

    const entityView = useMemo(() => {
        if (entityType !== SearchTypes.SearchEntityType.cafe || !cafeId) {
            return undefined;
        }

        return viewsById.get(cafeId);
    }, [entityType, cafeId, viewsById]);

    return {
        description: getResolvedCafeDescription(description, entityType, entityView),
        entityView,
        hasMissingRequiredCafeView: entityType === SearchTypes.SearchEntityType.cafe && !entityView,
    };
};

interface IUseSearchResultFavoriteIdParams {
    entityType: SearchTypes.SearchEntityType;
    entityView?: CafeView;
    name: string;
}

const useSearchResultFavoriteId = ({
    entityType,
    entityView,
    name,
}: IUseSearchResultFavoriteIdParams) => {
    const { viewsById } = useContext(ApplicationContext);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);

    return useMemo(
        () => {
            if (entityType === SearchTypes.SearchEntityType.cafe && entityView) {
                return getParentView(viewsById, entityView, shouldUseGroups).value.id;
            }

            return name; // For menu items and stations, we use the name as the favorite ID
        },
        [entityType, entityView, name, shouldUseGroups, viewsById]
    );
};

export const useIsSearchResultFavorite = (params: IUseSearchResultFavoriteIdParams) => {
    const favoriteId = useSearchResultFavoriteId(params);

    return useIsFavoriteItem(favoriteId, params.entityType);
};

interface IUseSearchResultFieldsParams {
    extraFields: ISearchResultField[];
    isCompact: boolean;
    matchedModifiers: Map<string, Set<string>>;
}

export const useSearchResultFields = ({
    extraFields,
    isCompact,
    matchedModifiers,
}: IUseSearchResultFieldsParams) => {
    return useMemo(
        () => {
            if (isCompact || matchedModifiers.size === 0) {
                return extraFields;
            }

            return [
                ...extraFields,
                ...getMatchedModifierFields(matchedModifiers),
            ];
        },
        [extraFields, isCompact, matchedModifiers]
    );
};

export const useSearchResultOrderCountDisplay = (entityKey?: string) => {
    const orderCount = useMenuItemOrderCount(entityKey);

    return formatOrderCount(orderCount);
};
