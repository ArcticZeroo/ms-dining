import { formatPrice } from '../../util/cart.ts';
import { getParentView } from '../../util/view.ts';
import { getJumpUrlOnSamePage, getViewMenuUrlWithJump } from '../../util/link.ts';
import { Link } from 'react-router-dom';
import { getLocationDatesDisplay } from '../../util/date.ts';
import { getViewName } from '../../util/cafe.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { ApplicationSettings } from '../../constants/settings.ts';
import React, { useContext } from 'react';
import { SelectedDateContext } from '../../context/time.ts';
import { ApplicationContext } from '../../context/app.ts';
import { SearchEntityType } from '@msdining/common/dist/models/search';
import { isSameDate } from '@msdining/common/dist/util/date-util';
import { classNames } from '../../util/react.ts';

const MAX_LOCATIONS_WITHOUT_CONDENSE = 5;

interface ISearchResultHitsProps {
    name: string;
    entityType: SearchEntityType;
    cafeIdsOnPage?: Set<string>;
    shouldShowLocationDates: boolean;
    onlyShowLocationsOnDate?: Date;
    isCompact: boolean;
    locationEntriesInOrder: Array<[string, Array<Date>]>;
    priceByCafeId?: Map<string, number>;
    stationByCafeId?: Map<string, string>;
    showOnlyCafeNames: boolean;
}

export const SearchResultHits: React.FC<ISearchResultHitsProps> = ({
    locationEntriesInOrder,
    priceByCafeId,
    stationByCafeId,
    name,
    entityType,
    cafeIdsOnPage,
    shouldShowLocationDates,
    isCompact,
    showOnlyCafeNames
}) => {
    const { viewsById } = useContext(ApplicationContext);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);
    const allowFutureMenus = useValueNotifier(ApplicationSettings.allowFutureMenus);
    const selectedDateNotifier = useContext(SelectedDateContext);
    const shouldCondenseNumbers = useValueNotifier(ApplicationSettings.shouldCondenseNumbers);
    const shouldUseCompactMode = useValueNotifier(ApplicationSettings.shouldUseCompactMode);
    const shouldShowPriceInSearch = useValueNotifier(ApplicationSettings.showPriceInSearch);

    if (locationEntriesInOrder.length === 0) {
        return (
            <div className="search-result-hits">
                <div className="search-result-chip grey">
                    <span className="value">
                        Not available this week.
                    </span>
                </div>
            </div>
        );
    }

    const useShortNames = shouldUseCompactMode
        || (shouldCondenseNumbers && locationEntriesInOrder.length > MAX_LOCATIONS_WITHOUT_CONDENSE);

    return (
        <div className="search-result-hits">
            {
                locationEntriesInOrder.map(([cafeId, locationDates]) => {
                    const view = viewsById.get(cafeId);

                    if (!view) {
                        return false;
                    }

                    const price = priceByCafeId?.get(cafeId);
                    const station = stationByCafeId?.get(cafeId);

                    const parentView = getParentView(viewsById, view, shouldUseGroups);
                    const targetDate = allowFutureMenus ? locationDates[0] : undefined;

                    const isAnyDateToday = locationDates.some(date => isSameDate(date, new Date()));

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
                            className={classNames('search-result-chip', !isAnyDateToday && 'grey')}
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
                                    {
                                        getViewName({
                                            view,
                                            useShortNames,
                                            showGroupName: true,
                                        })
                                    }
                                    {
                                        station && ` (${station})`
                                    }
                                </span>
                            </div>
                            {
                                !showOnlyCafeNames && (
                                    <>
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
                                        {
                                            shouldShowPriceInSearch && price != null && (
                                                <div className="chip-data">
                                                    <span className="material-symbols-outlined icon">
                                                        attach_money
                                                    </span>
                                                    <span className="value">
                                                        {formatPrice(price, false /*addCurrencySign*/)}
                                                    </span>
                                                </div>
                                            )
                                        }
                                    </>
                                )
                            }
                        </Link>
                    );
                })
            }
        </div>
    );
};