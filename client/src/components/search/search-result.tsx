import { DateUtil, SearchTypes } from '@msdining/common';
import { SearchMatchReason } from '@msdining/common/dist/models/search';
import { isSameDate } from '@msdining/common/dist/util/date-util';
import React, { useContext, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ApplicationSettings } from '../../constants/settings.ts';
import { ApplicationContext } from '../../context/app.ts';
import { SelectedDateContext } from '../../context/time.ts';
import { useIsFavoriteItem } from '../../hooks/cafe.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { CafeView } from '../../models/cafe.ts';
import { classNames } from '../../util/react';
import { compareNormalizedCafeIds, compareViewNames, normalizeCafeId } from '../../util/sorting.ts';
import { getSearchUrl } from '../../util/url.ts';
import { FavoriteSearchableItemButton } from '../button/favorite-searchable-item-button.tsx';
import { MenuItemTags } from '../cafes/station/menu-items/menu-item-tags.tsx';
import { SearchResultHits } from './search-result-hits.tsx';
import { SearchResultHitsSkeleton } from './skeleton/search-result-hits-skeleton.tsx';
import { SearchResultFindButton } from './search-result-find-button.tsx';

import './search.css';

interface IEntityDisplayData {
    className: string;
    iconName: string;
}

const entityDisplayDataByType: Record<SearchTypes.SearchEntityType, IEntityDisplayData> = {
    [SearchTypes.SearchEntityType.menuItem]: {
        className: 'entity-menu-item',
        iconName:  'lunch_dining'
    },
    [SearchTypes.SearchEntityType.station]:  {
        className: 'entity-station',
        iconName:  'restaurant'
    }
};

const getLocationEntries = (locationDatesByCafeId: Map<string, Date[]>, onlyShowLocationsOnDate: Date | undefined): Array<[string, Array<Date>]> => {
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

                if (DateUtil.isDateBefore(firstDateA, firstDateB)) {
                    return -1;
                }

                if (DateUtil.isDateAfter(firstDateA, firstDateB)) {
                    return 1;
                }

                // The more "limited time only" locations get to go first
                const lastDateA = datesA[datesA.length - 1];
                const lastDateB = datesB[datesB.length - 1];

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

interface ISearchResultField {
    key: string;
    iconName: string;
    value: React.ReactNode;
}

export interface ISearchResultProps {
    isVisible: boolean;
    name: string;
    description?: string;
    locationDatesByCafeId?: Map<string, Date[]>;
    stationByCafeId?: Map<string, string>;
    priceByCafeId?: Map<string, number>;
    imageUrl?: string;
    entityType: SearchTypes.SearchEntityType;
    extraFields?: ISearchResultField[];
    onlyShowLocationsOnDate?: Date;
    isCompact?: boolean;
    showFavoriteButton?: boolean;
    shouldColorForFavorites?: boolean;
    cafeIdsOnPage?: Set<string>;
    tags?: Set<string>;
    searchTags?: Set<string>;
    showSearchButtonInsteadOfLocations?: boolean;
    shouldStretchResults?: boolean;
    isSkeleton?: boolean;
    matchReasons?: Set<SearchMatchReason>;
    showOnlyCafeNames?: boolean;
    matchedModifiers?: Map<string, Set<string>>;
}

export const SearchResult: React.FC<ISearchResultProps> = ({
    isVisible,
    name,
    description,
    locationDatesByCafeId = new Map<string, Date[]>(),
    stationByCafeId = new Map<string, string>(),
    priceByCafeId = new Map<string, number>(),
    matchedModifiers = new Map<string, Set<string>>(),
    imageUrl,
    entityType,
    extraFields = [],
    onlyShowLocationsOnDate,
    isCompact = false,
    showFavoriteButton = !isCompact,
    shouldColorForFavorites = true,
    cafeIdsOnPage,
    tags,
    searchTags,
    showSearchButtonInsteadOfLocations = false,
    shouldStretchResults = false,
    isSkeleton = false,
    matchReasons = new Set(),
    showOnlyCafeNames = false
}) => {
    const { viewsById } = useContext(ApplicationContext);
    const showImages = useValueNotifier(ApplicationSettings.showImages);
    const showTags = useValueNotifier(ApplicationSettings.showTags);
    const showSearchTags = useValueNotifier(ApplicationSettings.showSearchTags);
    const allowFutureMenus = useValueNotifier(ApplicationSettings.allowFutureMenus);
    const selectedDateNotifier = useContext(SelectedDateContext);
    const selectedDate = useValueNotifier(selectedDateNotifier);

    const isFavoriteItem = useIsFavoriteItem(name, entityType);

    const entityDisplayData = entityDisplayDataByType[entityType];

    const shouldShowLocationDates = onlyShowLocationsOnDate != null
        ? !isSameDate(selectedDate, onlyShowLocationsOnDate)
        : allowFutureMenus;

    if (onlyShowLocationsOnDate == null && !allowFutureMenus) {
        onlyShowLocationsOnDate = selectedDate;
    }

    const locationEntriesInOrder = useLocationEntries({ viewsById, locationDatesByCafeId, onlyShowLocationsOnDate });

    if (!isSkeleton && locationEntriesInOrder.length === 0) {
        return null;
    }

    const imageElement = showImages && (
        imageUrl
            ? <img src={imageUrl} alt={name} className="search-result-image" decoding="async" loading="lazy"/>
            : isSkeleton && <div className="search-result-image"/>
    );

    if (matchedModifiers.size > 0) {
        for (const [modifierDescription, choiceDescriptions] of matchedModifiers) {
            extraFields.push({
                iconName: 'list',
                value:    `${cleanModifierDescription(modifierDescription)}${choiceDescriptions.size > 0 ? `: ${Array.from(choiceDescriptions).join(', ')}` : ''}`,
                key:      modifierDescription
            });
        }
    }

    const favoriteButton = showFavoriteButton && (
        <div>
            <FavoriteSearchableItemButton
                name={name}
                type={entityType}
            />
        </div>
    );

    return (
        <div className={classNames(
            'search-result',
            isVisible && 'visible',
            isCompact && 'compact',
            shouldColorForFavorites && isFavoriteItem && 'is-favorite',
            shouldStretchResults && 'self-stretch',
            isSkeleton && 'loading-skeleton'
        )}>
            <div className={classNames('flex-col search-result-type', entityDisplayData.className)}>
                {
                    isCompact && favoriteButton
                }
                <span className="material-symbols-outlined">
                    {entityDisplayData.iconName}
                </span>
            </div>
            <div className="search-result-info">
                <div className="search-result-info-header">
                    <div className="flex">
                        {!isCompact && favoriteButton}
                        <div className="title">
                            <span>
                                {name}
                            </span>
                            {
                                !isCompact && description &&
                                <div className="search-result-description">{description}</div>
                            }
                            {
                                tags && (showTags || matchReasons.has(SearchMatchReason.tags)) && (
                                    <MenuItemTags tags={tags} showName={!isCompact}/>
                                )
                            }
                        </div>
                    </div>
                    {
                        showSearchTags && (
                            <div className="search-tags">
                                {
                                    (searchTags != null && searchTags.size > 0) && Array.from(searchTags).map(tag => (
                                        <Link to={getSearchUrl(tag)} className="search-result-chip" key={tag}
                                            title={`Click to search for "${tag}"`}>
                                            {tag}
                                        </Link>
                                    ))
                                }
                            </div>
                        )
                    }
                    {
                        extraFields.length > 0 && (
                            <div className="search-result-fields">
                                {
                                    extraFields.map(({ iconName, value, key }) => (
                                        value && (
                                            <div className="search-result-field" key={key}>
                                                <span className="material-symbols-outlined icon">
                                                    {iconName}
                                                </span>
                                                <span className="value">
                                                    {value}
                                                </span>
                                            </div>
                                        )
                                    ))
                                }
                            </div>
                        )
                    }
                    {
                        isCompact && imageElement
                    }
                    {
                        !showSearchButtonInsteadOfLocations && (
                            isSkeleton
                                ? <SearchResultHitsSkeleton/>
                                : (
                                    <SearchResultHits
                                        name={name}
                                        entityType={entityType}
                                        onlyShowLocationsOnDate={onlyShowLocationsOnDate}
                                        isCompact={isCompact}
                                        locationEntriesInOrder={locationEntriesInOrder}
                                        cafeIdsOnPage={cafeIdsOnPage}
                                        shouldShowLocationDates={shouldShowLocationDates}
                                        priceByCafeId={priceByCafeId}
                                        stationByCafeId={stationByCafeId}
                                        showOnlyCafeNames={showOnlyCafeNames}
                                    />
                                )
                        )
                    }
                    {
                        showSearchButtonInsteadOfLocations && (
                            <SearchResultFindButton
                                name={name}
                                isSkeleton={isSkeleton}
                                cafeCount={locationEntriesInOrder.length}
                            />
                        )
                    }
                </div>
                {
                    !isCompact && imageElement
                }
            </div>
        </div>
    );
};