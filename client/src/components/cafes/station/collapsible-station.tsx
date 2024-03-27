import { SearchEntityType } from '@msdining/common/dist/models/search';
import { normalizeNameForSearch } from '@msdining/common/dist/util/search-util';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ApplicationSettings } from '../../../constants/settings.ts';
import { StationCollapseContext } from '../../../context/collapse.ts';
import { CafeHeaderHeightContext, StationHeaderHeightContext } from '../../../context/html.ts';
import { CurrentCafeContext, CurrentStationContext } from '../../../context/menu-item.ts';
import { useIsFavoriteItem } from '../../../hooks/cafe.ts';
import { useValueNotifierSetTarget } from '../../../hooks/events.ts';
import { useElementHeight, useScrollCollapsedHeaderIntoView } from '../../../hooks/html.ts';
import { ICafeStation, IMenuItemsByCategoryName } from '../../../models/cafe.ts';
import { getScrollAnchorId } from '../../../util/link.ts';
import { classNames } from '../../../util/react.ts';
import { FavoriteItemButton } from '../../button/favorite-item-button.tsx';
import { ScrollAnchor } from '../../button/scroll-anchor.tsx';
import { ExpandIcon } from '../../icon/expand.tsx';
import { StationMenu } from './menu-items/station-menu.tsx';

const useStationExpansion = (scrollAnchorId: string) => {
    const cafeHeaderHeight = useContext(CafeHeaderHeightContext);
    const collapsedStationsNotifier = useContext(StationCollapseContext);

    const isCollapsed = useValueNotifierSetTarget(collapsedStationsNotifier, scrollAnchorId);

    const stationHeaderStyle = useMemo(
        () => ({ top: `${cafeHeaderHeight}px` }),
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
    menu: IMenuItemsByCategoryName;
}

export const CollapsibleStation: React.FC<ICollapsibleStationProps> = ({ station, menu }) => {
    const cafe = useContext(CurrentCafeContext);
    const cafeHeaderHeight = useContext(CafeHeaderHeightContext);

    const [stationHeaderRef, setStationHeaderRef] = useState<HTMLDivElement | null>(null);
    const stationHeaderHeight = useElementHeight(stationHeaderRef);

    const normalizedName = useMemo(
        () => normalizeNameForSearch(station.name),
        [station.name]
    );

    const scrollAnchorId = useMemo(
        () => getScrollAnchorId({ cafeId: cafe.id, entityType: SearchEntityType.station, name: normalizedName }),
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
                    <ScrollAnchor id={scrollAnchorId} margin={`calc(${cafeHeaderHeight}px + var(--default-padding))`}/>
                    <div className="station-header flex-row" style={stationHeaderStyle} ref={setStationHeaderRef}>
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
                    <StationMenu
                        normalizedStationName={normalizedName}
                        menuItemsByCategoryName={menu}
                    />
                </div>
            </StationHeaderHeightContext.Provider>
        </CurrentStationContext.Provider>
    );
};