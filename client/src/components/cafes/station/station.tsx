import { SearchEntityType } from '@msdining/common/models/search';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ApplicationSettings } from '../../../constants/settings.ts';
import { StationCollapseContext } from '../../../context/collapse.ts';
import { CafeHeaderHeightContext, StationHeaderHeightContext } from '../../../context/html.ts';
import { CurrentCafeContext, CurrentStationContext } from '../../../context/menu-item.ts';
import { useIsFavoriteItem } from '../../../hooks/cafe.ts';
import { useValueNotifierSetTarget } from '../../../hooks/events.ts';
import { useElementHeight, useScrollCollapsedHeaderIntoView } from '../../../hooks/html.ts';
import { ICafeStation, MenuItemsByCategoryName } from '../../../models/cafe.ts';
import { getSearchAnchorId } from '../../../util/link.ts';
import { classNames } from '../../../util/react.ts';
import { FavoriteSearchableItemButton } from '../../button/favorite/favorite-searchable-item-button.tsx';
import { ScrollAnchor } from '../../button/scroll-anchor.tsx';
import { ExpandIcon } from '../../icon/expand.tsx';
import { StationMenu } from './menu-items/station-menu.tsx';

const useStationExpansion = (scrollAnchorId: string) => {
    const cafeHeaderHeight = useContext(CafeHeaderHeightContext);
    const collapsedStationsNotifier = useContext(StationCollapseContext);

    const isCollapsed = useValueNotifierSetTarget(collapsedStationsNotifier, scrollAnchorId);

    const stationHeaderStyle = useMemo(
        () => ({ top: `calc(${cafeHeaderHeight}px - var(--default-padding))` }),
        [cafeHeaderHeight]
    );

    const scrollIntoViewIfNeeded = useScrollCollapsedHeaderIntoView(scrollAnchorId);

    const updateIsCollapsed = useCallback(
        (isNowCollapsed: boolean) => {
            if (isNowCollapsed) {
                collapsedStationsNotifier.add(scrollAnchorId);
                scrollIntoViewIfNeeded();
            } else {
                collapsedStationsNotifier.delete(scrollAnchorId);
            }
        },
        [collapsedStationsNotifier, scrollAnchorId, scrollIntoViewIfNeeded]
    );

    const onTitleClick = () => {
        updateIsCollapsed(!isCollapsed);
    };

    useEffect(() => {
        if (ApplicationSettings.collapseStationsByDefault.value) {
            collapsedStationsNotifier.add(scrollAnchorId);
        }
    }, [collapsedStationsNotifier, scrollAnchorId]);

    return {
        isExpanded: !isCollapsed,
        stationHeaderStyle,
        onTitleClick
    };
}

export interface ICollapsibleStationProps {
    station: ICafeStation;
    menu: MenuItemsByCategoryName;
}

export const Station: React.FC<ICollapsibleStationProps> = ({ station, menu }) => {
    const cafe = useContext(CurrentCafeContext);
    const cafeHeaderHeight = useContext(CafeHeaderHeightContext);

    const [stationHeaderRef, setStationHeaderRef] = useState<HTMLDivElement | null>(null);
    const stationHeaderHeight = useElementHeight(stationHeaderRef);

    const normalizedName = useMemo(
        () => normalizeNameForSearch(station.name),
        [station.name]
    );

    const scrollAnchorId = useMemo(
        () => getSearchAnchorId({ cafeId: cafe.id, entityType: SearchEntityType.station, name: normalizedName }),
        [cafe.id, normalizedName]
    );

    const { isExpanded, stationHeaderStyle, onTitleClick } = useStationExpansion(scrollAnchorId);
    const isFavoriteStation = useIsFavoriteItem(station.name, SearchEntityType.station);

    return (
        <CurrentStationContext.Provider value={scrollAnchorId}>
            <StationHeaderHeightContext.Provider value={stationHeaderHeight}>
                <div
                    className={classNames('station', !isExpanded && 'collapsed', isFavoriteStation && 'is-favorite')}
                >
                    <ScrollAnchor id={scrollAnchorId} margin={`${cafeHeaderHeight}px`}/>
                    <div className="station-header flex-row" style={stationHeaderStyle} ref={setStationHeaderRef}>
                        <FavoriteSearchableItemButton name={station.name} type={SearchEntityType.station}/>
                        <button className="title" onClick={onTitleClick}>
                            {
                                station.logoUrl ? (
                                    <img
                                        src={station.logoUrl}
                                        alt={`Logo for station ${station.name}`}
                                        className="station-logo"
                                    />
                                ) : <span/>
                            }
                            <span className="flex">
                                {station.name}
                                {
                                    station.uniqueness.isTraveling && (
                                        <span className="number-badge" title="This station is traveling today. It won't be here tomorrow.">
                                            <span className="material-symbols-outlined">
                                                flight
                                            </span>
                                        </span>
                                    )
                                }
                                {
                                    !station.uniqueness.isTraveling && (station.uniqueness.itemDays[1] || 0) > 0 && (
                                        <span className="number-badge" title="Unique items available today only">
                                            {String(station.uniqueness.itemDays[1])}
                                        </span>
                                    )
                                }
                            </span>
                            <ExpandIcon isExpanded={isExpanded}/>
                        </button>
                    </div>
                    <StationMenu
                        station={station}
                        normalizedStationName={normalizedName}
                        menuItemsByCategoryName={menu}
                    />
                </div>
            </StationHeaderHeightContext.Provider>
        </CurrentStationContext.Provider>
    );
};