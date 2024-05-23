import { getParentView } from '../../util/view.ts';
import { getJumpUrlOnSamePage, getViewMenuUrlWithJump } from '../../util/link.ts';
import { Link } from 'react-router-dom';
import { getLocationDatesDisplay } from '../../util/date.ts';
import { CafeView, CafeViewType } from '../../models/cafe.ts';
import { getCafeName } from '../../util/cafe.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { ApplicationSettings } from '../../constants/settings.ts';
import React, { useContext } from 'react';
import { SelectedDateContext } from '../../context/time.ts';
import { ApplicationContext } from '../../context/app.ts';
import { SearchEntityType } from '@msdining/common/dist/models/search';

const getViewNameForSearchResult = (view: CafeView) => {
    if (view.type === CafeViewType.group) {
        return view.value.name;
    }

    return getCafeName(view.value, true /*showGroupName*/);
};

interface ISearchResultHitsProps {
	name: string;
	entityType: SearchEntityType;
	cafeIdsOnPage?: Set<string>;
	shouldShowLocationDates: boolean;
	onlyShowLocationsOnDate?: Date;
	isCompact: boolean;
	locationEntriesInOrder: Array<[string, Array<Date>]>;
}

export const SearchResultHits: React.FC<ISearchResultHitsProps> = ({ locationEntriesInOrder, name, entityType, cafeIdsOnPage, shouldShowLocationDates, isCompact }) => {
    const { viewsById } = useContext(ApplicationContext);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);
    const allowFutureMenus = useValueNotifier(ApplicationSettings.allowFutureMenus);
    const selectedDateNotifier = useContext(SelectedDateContext);

    return (
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
    )
}