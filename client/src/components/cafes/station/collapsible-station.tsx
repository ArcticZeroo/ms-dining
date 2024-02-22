import { SearchEntityType } from '@msdining/common/dist/models/search';
import { normalizeNameForSearch } from '@msdining/common/dist/util/search-util';
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CurrentCafeContext, CurrentStationContext } from '../../../context/menu-item.ts';
import { useIsFavoriteItem } from '../../../hooks/cafe.ts';
import { DeviceType, useDeviceType } from '../../../hooks/media-query.ts';
import { ICafeStation, IMenuItemsByCategoryName } from '../../../models/cafe.ts';
import { getScrollAnchorId } from '../../../util/link.ts';
import { classNames } from '../../../util/react.ts';
import { FavoriteItemButton } from '../../button/favorite-item-button.tsx';
import { ScrollAnchor } from '../../button/scroll-anchor.tsx';
import { ExpandIcon } from '../../icon/expand.tsx';
import { StationMenu } from './menu-items/station-menu.tsx';

import { ApplicationSettings } from '../../../constants/settings.ts';
import { StationCollapseContext } from '../../../context/collapse.ts';
import { useValueNotifier } from '../../../hooks/events.ts';

const useStationStyle = (isExpanded: boolean, widthPx: number | undefined) => {
    const deviceType = useDeviceType();

    // On Mobile, the station always has max width.
    if (isExpanded || !widthPx || deviceType === DeviceType.Mobile) {
        return {};
    }

    return {
        width:    `${widthPx}px`,
        flexGrow: '1'
    };
};

const useStationExpansion = (stationName: string) => {
    const collapsedStationsNotifier = useContext(StationCollapseContext);
    const collapsedStations = useValueNotifier(collapsedStationsNotifier);
    const menuBodyRef = useRef<HTMLDivElement>(null);
    const [menuWidthPx, setMenuWidthPx] = useState<number | undefined>(undefined);

    const isExpanded = useMemo(
        () => !collapsedStations.has(stationName),
        [collapsedStations, stationName]
    );

    const stationStyle = useStationStyle(isExpanded, menuWidthPx);

    const updateExpansionContext = useCallback(
        (isNowExpanded: boolean) => {
            console.log(stationName, isNowExpanded);

            const menuBodyElement = menuBodyRef.current;

            if (menuBodyElement && !isNowExpanded) {
                // Apparently the browser sometimes renders with partial pixels. Why?
                setMenuWidthPx(Math.ceil(menuBodyElement.offsetWidth));
            } else {
                setMenuWidthPx(undefined);
            }

            if (isNowExpanded) {
                collapsedStationsNotifier.delete(stationName);
            } else {
                collapsedStationsNotifier.add(stationName);
            }
        },
        [collapsedStationsNotifier, stationName]
    );

    const onTitleClick = () => {
        updateExpansionContext(!isExpanded);
    };

    useEffect(() => {
        if (ApplicationSettings.collapseStationsByDefault.value) {
            updateExpansionContext(false);
        }
    }, [updateExpansionContext]);

    return {
        isExpanded,
        menuBodyRef,
        stationStyle,
        onTitleClick
    };
}

export interface ICollapsibleStationProps {
    station: ICafeStation;
    menu: IMenuItemsByCategoryName;
}

export const CollapsibleStation: React.FC<ICollapsibleStationProps> = ({ station, menu }) => {
    const cafe = useContext(CurrentCafeContext);
    const { isExpanded, menuBodyRef, stationStyle, onTitleClick } = useStationExpansion(station.name);
    const isFavoriteStation = useIsFavoriteItem(station.name, SearchEntityType.station);

    const normalizedName = useMemo(
        () => normalizeNameForSearch(station.name),
        [station.name]
    );

    const scrollAnchorId = useMemo(
        () => getScrollAnchorId({ cafeId: cafe.id, entityType: SearchEntityType.station, name: normalizedName }),
        [cafe.id, normalizedName]
    );

    return (
        <CurrentStationContext.Provider value={station.name}>
            <div
                className={classNames('station', !isExpanded && 'collapsed', isFavoriteStation && 'is-favorite')}
                style={stationStyle}
            >
                <ScrollAnchor id={scrollAnchorId}/>
                <div className="station-header flex-row">
                    <FavoriteItemButton name={station.name} type={SearchEntityType.station}/>
                    <button className="title" onClick={onTitleClick}>
                        {
                            station.logoUrl && (
                                <img
                                    src={station.logoUrl}
                                    alt={`Logo for station ${station.name}`}
                                />
                            )
                        }
                        {station.name}
                        <ExpandIcon isExpanded={isExpanded}/>
                    </button>
                </div>
                <StationMenu menuItemsByCategoryName={menu} ref={menuBodyRef}/>
            </div>
        </CurrentStationContext.Provider>
    );
};