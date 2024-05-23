import { DateUtil, SearchTypes } from '@msdining/common';
import React, { useContext, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ApplicationContext } from '../../context/app.ts';
import { useIsFavoriteItem } from '../../hooks/cafe.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { CafeView } from '../../models/cafe.ts';
import { classNames } from '../../util/react';
import { compareNormalizedCafeIds, compareViewNames, normalizeCafeId } from '../../util/sorting.ts';
import './search.css';
import { FavoriteItemButton } from '../button/favorite-item-button.tsx';
import { ApplicationSettings } from '../../constants/settings.ts';
import { getSearchUrl } from '../../util/url.ts';
import { SearchResultHits } from './search-result-hits.tsx';
import { SelectedDateContext } from '../../context/time.ts';
import { isSameDate } from '@msdining/common/dist/util/date-util';
import { pluralize } from '../../util/string.ts';

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
	imageUrl?: string;
	entityType: SearchTypes.SearchEntityType;
	extraFields?: ISearchResultField[];
	onlyShowLocationsOnDate?: Date;
	isCompact?: boolean;
	showFavoriteButton?: boolean;
	shouldColorForFavorites?: boolean;
	cafeIdsOnPage?: Set<string>;
	searchTags?: Set<string>;
	showSearchButtonInsteadOfLocations?: boolean;
	shouldStretchResults?: boolean;
	isSkeleton?: boolean;
}

export const SearchResult: React.FC<ISearchResultProps> = ({
															   isVisible,
															   name,
															   description,
															   locationDatesByCafeId = new Map<string, Date[]>(),
															   imageUrl,
															   entityType,
															   extraFields,
															   onlyShowLocationsOnDate,
															   isCompact = false,
															   showFavoriteButton = !isCompact,
															   shouldColorForFavorites = true,
															   cafeIdsOnPage,
															   searchTags,
															   showSearchButtonInsteadOfLocations = false,
															   shouldStretchResults = false,
															   isSkeleton = false
														   }) => {
    const { viewsById } = useContext(ApplicationContext);
    const showImages = useValueNotifier(ApplicationSettings.showImages);
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

    const locationEntriesInOrder = useLocationEntries(viewsById, locationDatesByCafeId, onlyShowLocationsOnDate);

    if (!isSkeleton && locationEntriesInOrder.length === 0) {
        return null;
    }
	
    const imageElement = showImages && (
        imageUrl 
            ? <img src={imageUrl} alt={name} className="search-result-image" decoding="async" loading="lazy"/>
            : isSkeleton && <div className="search-result-image"/>
    );

    const favoriteButton = showFavoriteButton && (
        <div>
            <FavoriteItemButton
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
                    {
                        !showSearchButtonInsteadOfLocations && (
                            <SearchResultHits
                                name={name}
                                entityType={entityType}
                                onlyShowLocationsOnDate={onlyShowLocationsOnDate}
                                isCompact={isCompact}
                                locationEntriesInOrder={locationEntriesInOrder}
                                cafeIdsOnPage={cafeIdsOnPage}
                                shouldShowLocationDates={shouldShowLocationDates}
                            />
                        )
                    }
                    {
                        showSearchButtonInsteadOfLocations && (
                            <Link to={getSearchUrl(name)}
								  className="default-container default-button text-center text-nowrap">
								🔍 find in {isSkeleton ? '...' : locationEntriesInOrder.length} {pluralize('cafe', locationEntriesInOrder.length)}
                            </Link>
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