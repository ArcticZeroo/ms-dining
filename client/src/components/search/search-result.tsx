import React, { useContext, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ApplicationSettings } from '../../api/settings.ts';
import { ApplicationContext } from '../../context/app.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { ISearchResult, SearchEntityType } from '../../models/search.ts';
import { getLocationDatesDisplay } from '../../util/date.ts';
import { getViewUrl } from '../../util/link.ts';
import { classNames } from '../../util/react';
import { compareNormalizedCafeIds, normalizeCafeId } from '../../util/sorting.ts';
import { getParentView } from '../../util/view';
import { DateUtil } from '@msdining/common';
import './search.css';

interface IEntityDisplayData {
    className: string;
    iconName: string;
}

const entityDisplayDataByType: Record<SearchEntityType, IEntityDisplayData> = {
    [SearchEntityType.menuItem]: {
        className: 'entity-menu-item',
        iconName:  'lunch_dining'
    },
    [SearchEntityType.station]:  {
        className: 'entity-station',
        iconName:  'restaurant'
    }
};

interface ISearchResultProps {
    result: ISearchResult;
    isVisible: boolean;
}

export const SearchResult: React.FC<ISearchResultProps> = ({ isVisible, result: { name, description, locationDatesByCafeId, imageUrl, entityType } }) => {
    const { viewsById } = useContext(ApplicationContext);
    const showImages = useValueNotifier(ApplicationSettings.showImages);
    const useGroups = useValueNotifier(ApplicationSettings.useGroups);

    const locationEntriesInOrder = useMemo(
        () => {
            const locationEntries = Array.from(locationDatesByCafeId.entries());
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
        [locationDatesByCafeId]
    );

    const entityDisplayData = entityDisplayDataByType[entityType];

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
                    </div>
                    <div className="search-result-hits">
                        {
                            locationEntriesInOrder.map(([cafeId, locationDates]) => {
                                const view = viewsById.get(cafeId);

                                if (!view) {
                                    return false;
                                }

                                const parentView = getParentView(viewsById, useGroups, view);

                                return (
                                    <Link to={getViewUrl(parentView)} className="search-result-chip"
                                          key={view.value.id}>
                                        <div className="chip-data">
                                            <span className="material-symbols-outlined icon">
                                                location_on
                                            </span>
                                            <span className="value">
                                                {view.value.name}
                                            </span>
                                        </div>
                                        <div className="chip-data">
                                            <span className="material-symbols-outlined icon">
                                                timer
                                            </span>
                                            <span className="value">
                                                {getLocationDatesDisplay(locationDates)}
                                            </span>
                                        </div>
                                    </Link>
                                );
                            })
                        }
                    </div>
                </div>
                {
                    (imageUrl && showImages) && (
                        <img src={imageUrl} alt={name} className="search-result-image"/>
                    )
                }
            </div>
        </div>
    );
};