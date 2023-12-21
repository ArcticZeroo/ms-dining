import { DateUtil, SearchTypes } from '@msdining/common';
import React, { useContext, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ApplicationSettings } from '../../api/settings.ts';
import { ApplicationContext } from '../../context/app.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { CafeView, CafeViewType } from '../../models/cafe.ts';
import { getCafeName } from '../../util/cafe.ts';
import { getLocationDatesDisplay } from '../../util/date.ts';
import { getViewUrl } from '../../util/link.ts';
import { classNames } from '../../util/react';
import { compareNormalizedCafeIds, normalizeCafeId } from '../../util/sorting.ts';
import { getParentView } from '../../util/view';
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

const getLocationEntries = (locationDatesByCafeId: Map<string, Date[]>, allowFutureMenus: boolean): Array<[string, Array<Date>]> => {
    const locationEntries = Array.from(locationDatesByCafeId.entries());

    if (allowFutureMenus) {
        return locationEntries;
    }

    const now = new Date();
    const resultEntries: Array<[string, Array<Date>]> = [];
    for (const [cafeId, dates] of locationEntries) {
        const filteredDates = dates.filter(date => DateUtil.isSameDate(date, now));
        if (filteredDates.length > 0) {
            resultEntries.push([cafeId, filteredDates]);
        }
    }
    return resultEntries;
};

const useLocationEntries = (locationDatesByCafeId: Map<string, Date[]>, allowFutureMenus: boolean) => {
    return useMemo(
        () => {
            const locationEntries = getLocationEntries(locationDatesByCafeId, allowFutureMenus);

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

                return compareNormalizedCafeIds(normalizeCafeId(cafeA), normalizeCafeId(cafeB));
            });
        },
        [locationDatesByCafeId, allowFutureMenus]
    );
}

const getViewNameForSearchResult = (view: CafeView) => {
    if (view.type === CafeViewType.group) {
        return view.value.name;
    }

    return getCafeName(view.value, true /*showGroupName*/);
}

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
}

export const SearchResult: React.FC<ISearchResultProps> = ({
                                                               isVisible,
                                                               name,
                                                               description,
                                                               locationDatesByCafeId,
                                                               imageUrl,
                                                               entityType,
                                                               extraFields
                                                           }) => {
    const { viewsById } = useContext(ApplicationContext);
    const showImages = useValueNotifier(ApplicationSettings.showImages);
    const allowFutureMenus = useValueNotifier(ApplicationSettings.allowFutureMenus);

    const entityDisplayData = entityDisplayDataByType[entityType];

    const locationEntriesInOrder = useLocationEntries(locationDatesByCafeId, allowFutureMenus);

    return (
        <div className={classNames('search-result', isVisible && 'visible')}>
            <div className={classNames('search-result-type', entityDisplayData.className)}>
                        <span className="material-symbols-outlined">
                            {entityDisplayData.iconName}
                        </span>
            </div>
            <div className="search-result-info">
                <div className="search-result-info-header">
                    <div className="search-result-name">
                        {name}
                        {
                            description && <div className="search-result-description">{description}</div>
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
                        <div className="search-result-fields">
                        </div>
                    </div>
                    <div className="search-result-hits">
                        {
                            locationEntriesInOrder.map(([cafeId, locationDates]) => {
                                const view = viewsById.get(cafeId);

                                if (!view) {
                                    return false;
                                }

                                const parentView = getParentView(viewsById, view);

                                return (
                                    <Link to={getViewUrl(parentView)}
                                          className="search-result-chip"
                                          key={view.value.id}>
                                        <div className="chip-data">
                                            <span className="material-symbols-outlined icon">
                                                location_on
                                            </span>
                                            <span className="value">
                                                {getViewNameForSearchResult(view)}
                                            </span>
                                        </div>
                                        {
                                            allowFutureMenus && (
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
                    (imageUrl && showImages) && (
                        <img src={imageUrl} alt={name} className="search-result-image" decoding="async" loading="lazy"/>
                    )
                }
            </div>
        </div>
    );
};