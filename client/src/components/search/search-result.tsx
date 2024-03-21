import { DateUtil, SearchTypes } from '@msdining/common';
import { isSameDate } from '@msdining/common/dist/util/date-util';
import React, { useContext, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ApplicationContext } from '../../context/app.ts';
import { SelectedDateContext } from '../../context/time.ts';
import { useIsFavoriteItem } from '../../hooks/cafe.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { CafeView, CafeViewType } from '../../models/cafe.ts';
import { getCafeName } from '../../util/cafe.ts';
import { getLocationDatesDisplay } from '../../util/date.ts';
import { getJumpUrlOnSamePage, getViewMenuUrlWithJump } from '../../util/link.ts';
import { classNames } from '../../util/react';
import { compareNormalizedCafeIds, compareViewNames, normalizeCafeId } from '../../util/sorting.ts';
import { getParentView } from '../../util/view';
import './search.css';
import { FavoriteItemButton } from '../button/favorite-item-button.tsx';
import { ApplicationSettings } from '../../constants/settings.ts';
import { normalizeNameForSearch } from '@msdining/common/dist/util/search-util';

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

const useLocationEntries = (viewsById: Map<string, CafeView>, locationDatesByCafeId: Map<string, Date[]>, onlyShowLocationsOnDate: Date | undefined) => {
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
        [viewsById, locationDatesByCafeId, onlyShowLocationsOnDate]
    );
};

// Some search tags are already in the name/description
const useSearchTags = (name: string, description: string | undefined, searchTags: Set<string> | undefined) => {
    return useMemo(
        () => {
            if (searchTags == null) {
                return [];
            }

            const tags = Array.from(searchTags);

            if (tags.length === 0) {
                return [];
            }

            return tags.filter(tag => {
                const normalizedTag = normalizeNameForSearch(tag);
                return !normalizeNameForSearch(name).includes(normalizedTag)
                    && (!description || !normalizeNameForSearch(description).includes(normalizedTag));
            });
        },
        [searchTags, name, description]
    );
}

const getViewNameForSearchResult = (view: CafeView) => {
    if (view.type === CafeViewType.group) {
        return view.value.name;
    }

    return getCafeName(view.value, true /*showGroupName*/);
};

interface ISearchResultField {
    key: string;
    iconName: string;
    value: React.ReactNode;
}

interface ISearchResultProps {
    isVisible: boolean;
    name: string;
    description?: string;
    locationDatesByCafeId: Map<string, Date[]>;
    imageUrl?: string;
    entityType: SearchTypes.SearchEntityType;
    extraFields?: ISearchResultField[];
    onlyShowLocationsOnDate?: Date;
    isCompact?: boolean;
    showFavoriteButton?: boolean;
    shouldColorForFavorites?: boolean;
    cafeIdsOnPage?: Set<string>;
    searchTags?: Set<string>;
}

export const SearchResult: React.FC<ISearchResultProps> = ({
    isVisible,
    name,
    description,
    locationDatesByCafeId,
    imageUrl,
    entityType,
    extraFields,
    onlyShowLocationsOnDate,
    isCompact = false,
    showFavoriteButton = !isCompact,
    shouldColorForFavorites = true,
    cafeIdsOnPage,
    searchTags
}) => {
    const { viewsById } = useContext(ApplicationContext);
    const showImages = useValueNotifier(ApplicationSettings.showImages);
    const showSearchTags = useValueNotifier(ApplicationSettings.showSearchTags);
    const allowFutureMenus = useValueNotifier(ApplicationSettings.allowFutureMenus);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);
    const selectedDateNotifier = useContext(SelectedDateContext);
    const selectedDate = useValueNotifier(selectedDateNotifier);

    const isFavoriteItem = useIsFavoriteItem(name, entityType);

    const searchTagsToShow = useSearchTags(name, description, searchTags);

    const entityDisplayData = entityDisplayDataByType[entityType];

    const shouldShowLocationDates = onlyShowLocationsOnDate != null
        ? !isSameDate(selectedDate, onlyShowLocationsOnDate)
        : allowFutureMenus;

    if (onlyShowLocationsOnDate == null && !allowFutureMenus) {
        onlyShowLocationsOnDate = selectedDate;
    }

    const locationEntriesInOrder = useLocationEntries(viewsById, locationDatesByCafeId, onlyShowLocationsOnDate);

    if (locationEntriesInOrder.length === 0) {
        return null;
    }

    const imageElement = (imageUrl && showImages) && (
        <img src={imageUrl} alt={name} className="search-result-image" decoding="async" loading="lazy"/>
    );

    return (
        <div className={classNames(
            'search-result',
            isVisible && 'visible',
            isCompact && 'compact',
            shouldColorForFavorites && isFavoriteItem && 'is-favorite'
        )}>
            <div className={classNames('search-result-type', entityDisplayData.className)}>
                <span className="material-symbols-outlined">
                    {entityDisplayData.iconName}
                </span>
            </div>
            <div className="search-result-info">
                <div className="search-result-info-header">
                    <div className="flex">
                        {
                            showFavoriteButton
                            && (
                                <div>
                                    <FavoriteItemButton
                                        name={name}
                                        type={entityType}
                                    />
                                </div>
                            )
                        }
                        <div className="search-result-name">
                            {name}
                            {
                                description && <div className="search-result-description">{description}</div>
                            }
                        </div>
                    </div>
                    {
                        showSearchTags && (
                            <div className="search-tags">
                                {
                                    searchTagsToShow.length > 0 && searchTagsToShow.map(tag => (
                                        <Link to={`/search?q=${tag}`} className="search-result-chip" key={tag} title={`Click to search for "${tag}"`}>
                                            {tag}
                                        </Link>
                                    ))
                                }
                            </div>
                        )
                    }
                    {
                        extraFields && (
                            <div className="search-result-fields">
                                {
                                    extraFields.map(({ iconName, value, key }) => (
                                        value &&
                                        <div className="search-result-field" key={key}>
													    <span className="material-symbols-outlined icon">
													        {iconName}
													    </span>
                                            <span className="value">
													        {value}
													    </span>
                                        </div>
                                    ))
                                }
                            </div>
                        )
                    }
                    {
                        isCompact && imageElement
                    }
                    <div className="search-result-hits">
                        {
                            locationEntriesInOrder.map(([cafeId, locationDates]) => {
                                const view = viewsById.get(cafeId);

                                if (!view) {
                                    return false;
                                }

                                const parentView = getParentView(viewsById, view, shouldUseGroups);
                                const targetDate = allowFutureMenus ? locationDates[0] : undefined;

                                const onLinkClick = () => {
                                    if (targetDate != null) {
                                        selectedDateNotifier.value = targetDate;
                                    }
                                };

                                const url = cafeIdsOnPage != null && cafeIdsOnPage.has(cafeId)
                                    ? getJumpUrlOnSamePage({ entityType, name, cafeId })
                                    : getViewMenuUrlWithJump({
                                        cafeId,
                                        name,
                                        entityType,
                                        view: parentView,
                                        date: targetDate
                                    });

                                return (
                                    <Link
                                        to={url}
                                        className="search-result-chip"
                                        key={view.value.id}
                                        onClick={onLinkClick}
                                    >
                                        <div className="chip-data">
                                            {
                                                !isCompact
                                                && (
                                                    <span className="material-symbols-outlined icon">
                                                        location_on
												    </span>
                                                )
                                            }
                                            <span className="value">
                                                {getViewNameForSearchResult(view)}
                                            </span>
                                        </div>
                                        {
                                            shouldShowLocationDates && (
                                                <div className="chip-data">
                                                    <span className="material-symbols-outlined icon">
														timer
                                                    </span>
                                                    <span className="value">
                                                        {getLocationDatesDisplay(locationDates)}
                                                    </span>
                                                </div>
                                            )
                                        }
                                    </Link>
                                );
                            })
                        }
                    </div>
                </div>
                {
                    !isCompact && imageElement
                }
            </div>
        </div>
    );
};