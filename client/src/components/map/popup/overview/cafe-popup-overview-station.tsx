import { ICafeOverviewStation } from '@msdining/common/models/cafe';
import { SearchEntityType } from '@msdining/common/models/search';
import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { MapPopupViewContext } from '../../../../context/map.ts';
import { SelectedDateContext } from '../../../../context/time.ts';
import { useValueNotifierContext } from '../../../../hooks/events.ts';
import { ICafe } from '../../../../models/cafe.ts';
import { getSearchAnchorJumpUrlOnAnotherPage } from '../../../../util/link.ts';
import { pluralize } from '../../../../util/string.ts';
import { getIsRecentlyAvailable } from '@msdining/common/util/date-util';
import { classNames } from '../../../../util/react.js';

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

    const uniqueItemsToday = itemDays[1] || 0;
    if (uniqueItemsToday > 0) {
        return `${uniqueItemsToday} ${pluralize('item', uniqueItemsToday)} on this station's menu are only available today this week`;
    }

    return undefined;
};

const getStationBadge = ({ uniqueness: { isTraveling, recentlyAvailableItemCount, itemDays } }: ICafeOverviewStation, didOpenRecently: boolean) => {
    if (didOpenRecently) {
        return (
            '✨ Opened Recently'
        );
    }

    if (isTraveling) {
        return (
            <>
                <span className="material-symbols-outlined">
                    flight
                </span>
                <span>
                    Traveling Station
                </span>
            </>
        );
    }

    if (recentlyAvailableItemCount > 0) {
        return (
            '✨ New Items'
        );
    }

    const itemsHereTodayOnlyCount = itemDays[1] || 0;
    if (itemsHereTodayOnlyCount > 0) {
        return `${itemsHereTodayOnlyCount} Traveling ${pluralize('Item', itemsHereTodayOnlyCount)}`;
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

    const didOpenRecently = getIsRecentlyAvailable(station.uniqueness.firstAppearance);
    const badge = getStationBadge(station, didOpenRecently);
    console.log(station, didOpenRecently, badge);

    const children = (
        <>
            <div className="flex flex-between">
                <span className="flex">
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
                </span>
                <span className={classNames('flex flex-center', badge && 'text-badge')}>
                    {badge}
                </span>
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
        </>
    );

    if (!popupView) {
        return (
            <div
                className="overview-station default-container flex-col"
                title={getStationTitle(station, didOpenRecently)}
            >
                {children}
            </div>
        );
    }

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
            {children}
        </Link>
    );
};