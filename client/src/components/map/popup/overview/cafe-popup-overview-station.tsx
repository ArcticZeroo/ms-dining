import { ICafeOverviewStation } from '@msdining/common/dist/models/cafe';
import { SearchEntityType } from '@msdining/common/dist/models/search';
import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { MapPopupViewContext } from '../../../../context/map.ts';
import { SelectedDateContext } from '../../../../context/time.ts';
import { useValueNotifierContext } from '../../../../hooks/events.ts';
import { ICafe } from '../../../../models/cafe.ts';
import { getViewMenuUrlWithJump } from '../../../../util/link.ts';
import { pluralize } from "../../../../util/string.ts";

const getStationTitle = (station: ICafeOverviewStation) => {
    if (station.uniqueness.isTraveling) {
        return `This station ${
            station.uniqueness.daysThisWeek === 1
                ? 'is only available here today this week'
                : 'is traveling here today and may return another day this week'
        }`;
    }

    const uniqueItemsToday = station.uniqueness.itemDays[1];
    if (uniqueItemsToday > 0) {
        return `${uniqueItemsToday} ${pluralize('item', uniqueItemsToday)} on this station's menu are only available today this week`;
    }

    return undefined;
}

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

    return (
        <Link
            className="flex overview-station"
            to={getViewMenuUrlWithJump({
                cafeId: cafe.id,
                view: popupView,
                entityType: SearchEntityType.station,
                name: station.name,
                date: selectedDate
            })}
            title={getStationTitle(station)}
        >
            {
                station.logoUrl && (
                    <img
                        src={station.logoUrl}
                        alt={`${station.name} logo`}
                        className="station-logo"
                    />
                )
            }
            {station.name}
            <span className="badge flex flex-center">
                {
                    station.uniqueness.isTraveling && (
                        <span className="material-symbols-outlined">
                            work
                        </span>
                    )
                }
                {
                    !station.uniqueness.isTraveling && (
                        station.uniqueness.itemDays[1]
                    )
                }
            </span>
            {
            }
        </Link>
    );
};