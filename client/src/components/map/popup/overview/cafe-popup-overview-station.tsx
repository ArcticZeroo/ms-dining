import { ICafeOverviewStation } from '@msdining/common/dist/models/cafe';
import { SearchEntityType } from '@msdining/common/dist/models/search';
import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { MapPopupViewContext } from '../../../../context/map.ts';
import { SelectedDateContext } from '../../../../context/time.ts';
import { useValueNotifierContext } from '../../../../hooks/events.ts';
import { ICafe } from '../../../../models/cafe.ts';
import { getSearchAnchorJumpUrlOnAnotherPage } from '../../../../util/link.ts';
import { pluralize } from '../../../../util/string.ts';

const getStationTitle = (station: ICafeOverviewStation) => {
    if (station.uniqueness.isTraveling) {
        return `This station ${
            station.uniqueness.daysThisWeek === 1
                ? 'is only here today this week'
                : 'is traveling here today and may return another day this week'
        }`;
    }

    const uniqueItemsToday = station.uniqueness.itemDays[1];
    if (uniqueItemsToday > 0) {
        return `${uniqueItemsToday} ${pluralize('item', uniqueItemsToday)} on this station's menu are only available today this week`;
    }

    return undefined;
};

interface ICafePopupOverviewStationProps {
    cafe: ICafe;
    station: ICafeOverviewStation;
}

export const CafePopupOverviewStation: React.FC<ICafePopupOverviewStationProps> = ({ cafe, station }) => {
    const popupView = useContext(MapPopupViewContext);
    const selectedDate = useValueNotifierContext(SelectedDateContext);

    if (!popupView) {
        return null;
    }

    const itemsHereTodayOnlyCount = station.uniqueness.itemDays[1];
    const shouldShowBadge = station.uniqueness.isTraveling || itemsHereTodayOnlyCount > 0;

    return (
        <Link
            className="overview-station"
            to={getSearchAnchorJumpUrlOnAnotherPage({
                cafeId:     cafe.id,
                view:       popupView,
                entityType: SearchEntityType.station,
                name:       station.name,
                date:       selectedDate
            })}
            title={getStationTitle(station)}
        >
            <div className="flex flex-between">
                {
                    station.logoUrl && (
                        <img
                            src={station.logoUrl}
                            alt={`${station.name} logo`}
                            className="logo-small"
                        />
                    )
                }
                <span>
                    {station.name}
                </span>
                {
                    shouldShowBadge ? (
                        <span className="badge flex flex-center">
                            {
                                station.uniqueness.isTraveling && (
                                    <span className="material-symbols-outlined">
                            flight
                                    </span>
                                )
                            }
                            {
                                !station.uniqueness.isTraveling && (
                                    itemsHereTodayOnlyCount
                                )
                            }
                        </span>
                    ) : <span/>
                }
            </div>
            {
                station.uniqueness.theme != null && (
                    <div className="subtitle">
                        {station.uniqueness.theme}
                    </div>
                )
            }
        </Link>
    );
};