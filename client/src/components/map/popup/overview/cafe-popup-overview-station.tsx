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
import { getIsRecentlyAvailable } from '@msdining/common/dist/util/date-util';

const getStationTitle = ({ uniqueness: { isTraveling, daysThisWeek, recentlyAvailableItemCount, itemDays } }: ICafeOverviewStation, didOpenRecently: boolean) => {
    if (didOpenRecently) {
        return 'This station is new to this cafe!';
    }

    if (isTraveling) {
        return `This station ${
            daysThisWeek === 1
                ? 'is only here today this week'
                : 'is traveling here today and may return another day this week'
        }`;
    }

    if (recentlyAvailableItemCount > 0) {
        return `${recentlyAvailableItemCount} ${pluralize('item', recentlyAvailableItemCount)} on this station's menu are new to this cafe`;
    }

    const uniqueItemsToday = itemDays[1];
    if (uniqueItemsToday > 0) {
        return `${uniqueItemsToday} ${pluralize('item', uniqueItemsToday)} on this station's menu are only available today this week`;
    }

    return undefined;
};

const getStationBadge = ({ uniqueness: { isTraveling, recentlyAvailableItemCount, itemDays } }: ICafeOverviewStation, didOpenRecently: boolean) => {
    if (didOpenRecently) {
        return (
            '✨'
        );
    }

    if (isTraveling) {
        return (
            <span className="material-symbols-outlined">
                flight
            </span>
        );
    }

    if (recentlyAvailableItemCount > 0) {
        return (
            '✨'
        );
    }

    const itemsHereTodayOnlyCount = itemDays[1];
    if (itemsHereTodayOnlyCount > 0) {
        return itemsHereTodayOnlyCount;
    }

    return null;
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
    const didOpenRecently = getIsRecentlyAvailable(station.uniqueness.firstAppearance);

    return (
        <Link
            className={"overview-station default-container flex-col"}
            to={getSearchAnchorJumpUrlOnAnotherPage({
                cafeId:     cafe.id,
                view:       popupView,
                entityType: SearchEntityType.station,
                name:       station.name,
                date:       selectedDate
            })}
            title={getStationTitle(station, didOpenRecently)}
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
                <span className="flex">
                    {
                        didOpenRecently && (
                            <span className="recently-opened-notice default-container" title="This station is new to this cafe!">
                                New!
                            </span>
                        )
                    }
                    {station.name}
                </span>
                {
                    shouldShowBadge ? (
                        <span className="badge flex flex-center">
                            {getStationBadge(station, didOpenRecently)}
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
            {
                !didOpenRecently && station.uniqueness.recentlyAvailableItemCount > 0 && (
                    <div className="recently-opened-notice default-container" title={`This station has ${station.uniqueness.recentlyAvailableItemCount} new items`}>
                        {station.uniqueness.recentlyAvailableItemCount} new {pluralize('item', station.uniqueness.recentlyAvailableItemCount)}
                    </div>
                )
            }
        </Link>
    );
};