import { ICafeOverviewStation } from '@msdining/common/dist/models/cafe';
import { SearchEntityType } from '@msdining/common/dist/models/search';
import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { MapPopupViewContext } from '../../../../context/map.ts';
import { SelectedDateContext } from '../../../../context/time.ts';
import { useValueNotifierContext } from '../../../../hooks/events.ts';
import { ICafe } from '../../../../models/cafe.ts';
import { getViewMenuUrlWithJump } from '../../../../util/link.ts';

interface ICafePopupOverviewStationProps {
    cafe: ICafe;
    station: ICafeOverviewStation;
}

export const CafePopupOverviewStation: React.FC<ICafePopupOverviewStationProps> = ({ cafe, station }) => {
    const popupView = useContext(MapPopupViewContext);
    const selectedDate = useValueNotifierContext(SelectedDateContext);

    // TODO: Maybe we can show some stations with uniqueness data if none are traveling?
    if (!popupView || !station.uniqueness.isTraveling) {
        return null;
    }

    return (
        <Link className="flex overview-station" to={getViewMenuUrlWithJump({
            cafeId:     cafe.id,
            view:       popupView,
            entityType: SearchEntityType.station,
            name:       station.name,
            date:       selectedDate
        })}>
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
        </Link>
    );
};