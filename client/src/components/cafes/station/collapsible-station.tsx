import { SearchEntityType } from '@msdining/common/dist/models/search';
import { normalizeNameForSearch } from '@msdining/common/dist/util/search-util';
import React, { useMemo, useRef, useState } from 'react';
import { useIsFavoriteItem } from '../../../hooks/cafe.ts';
import { DeviceType, useDeviceType } from '../../../hooks/media-query.ts';
import { ICafeStation, IMenuItemsByCategoryName } from '../../../models/cafe.ts';
import { idPrefixByEntityType } from '../../../util/link.ts';
import { classNames } from '../../../util/react.ts';
import { FavoriteItemButton } from '../../button/favorite-item-button.tsx';
import { ScrollAnchor } from '../../button/scroll-anchor.tsx';
import { ExpandIcon } from '../../icon/expand.tsx';
import { StationMenu } from './menu-items/station-menu.tsx';

const useStationStyle = (isExpanded: boolean, widthPx: number | undefined) => {
    const deviceType = useDeviceType();

    // On Mobile, the station always has max width.
    if (isExpanded || !widthPx || deviceType === DeviceType.Mobile) {
        return {};
    }

    return {
        width: `${widthPx}px`
    };
};

export interface ICollapsibleStationProps {
    station: ICafeStation;
    menu: IMenuItemsByCategoryName;
}

export const CollapsibleStation: React.FC<ICollapsibleStationProps> = ({ station, menu }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const menuBodyRef = useRef<HTMLDivElement>(null);
    const [menuWidthPx, setMenuWidthPx] = useState<number | undefined>(undefined);

    const stationStyle = useStationStyle(isExpanded, menuWidthPx);

    const isFavoriteStation = useIsFavoriteItem(station.name, SearchEntityType.station);

    const onTitleClick = () => {
        const isNowExpanded = !isExpanded;

        const menuBodyElement = menuBodyRef.current;

        if (menuBodyElement && !isNowExpanded) {
            // Apparently the browser sometimes renders with partial pixels. Why?
            setMenuWidthPx(Math.ceil(menuBodyElement.offsetWidth));
        } else {
            setMenuWidthPx(undefined);
        }

        setIsExpanded(isNowExpanded);
    };

    const normalizedName = useMemo(
        () => normalizeNameForSearch(station.name),
        [station.name]
    );

    return (
        <div className={classNames('station', !isExpanded && 'collapsed', isFavoriteStation && 'is-favorite')} style={stationStyle}>
            <ScrollAnchor id={`${idPrefixByEntityType[SearchEntityType.station]}-${normalizedName}`}/>
            <div className="station-header flex-row">
                <FavoriteItemButton name={station.name} type={SearchEntityType.station}/>
                <button className="title" onClick={onTitleClick}>
                    {
                        station.logoUrl && (
                            <img src={station.logoUrl}
                                alt={`Logo for station ${station.name}`}/>
                        )
                    }
                    {station.name}
                    <ExpandIcon isExpanded={isExpanded}/>
                </button>
            </div>
            <StationMenu menuItemsByCategoryName={menu} ref={menuBodyRef}/>
        </div>
    );
};