import { IMenuItem } from '@msdining/common/models/cafe';
import { SearchEntityType } from '@msdining/common/models/search';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import React, { useContext, useMemo } from 'react';
import { ApplicationSettings } from '../../../../constants/settings.ts';
import { CafeHeaderHeightContext, StationHeaderHeightContext } from '../../../../context/html.ts';
import { CurrentCafeContext } from '../../../../context/menu-item.ts';
import { useValueNotifier } from '../../../../hooks/events.ts';
import { getSearchAnchorId } from '../../../../util/link.ts';
import { ScrollAnchor } from '../../../button/scroll-anchor.tsx';

const useScrollAnchorMargin = () => {
    const cafeHeaderHeight = useContext(CafeHeaderHeightContext);
    const stationHeaderHeight = useContext(StationHeaderHeightContext);

    return useMemo(
        // 1rem of padding vertically on cafe header, plus 1rem from the bottom of the station header
        () => `calc(${cafeHeaderHeight + stationHeaderHeight}px + 1rem)`,
        [cafeHeaderHeight, stationHeaderHeight]
    );
};

interface IMenuItemHeaderProps {
    menuItem: IMenuItem;
}

export const MenuItemHeader: React.FC<IMenuItemHeaderProps> = ({ menuItem }) => {
    const cafe = useContext(CurrentCafeContext);
    const showDescriptions = useValueNotifier(ApplicationSettings.showDescriptions);
    const scrollAnchorMargin = useScrollAnchorMargin();

    const scrollAnchorId = useMemo(
        () => getSearchAnchorId({
            cafeId:     cafe.id,
            name:       normalizeNameForSearch(menuItem.name),
            entityType: SearchEntityType.menuItem,
        }),
        [cafe.id, menuItem.name]
    );

    return (
        <div className="menu-item-head">
            {/*Scroll anchor is in the head to avoid extra gap*/}
            <ScrollAnchor id={scrollAnchorId} margin={scrollAnchorMargin}/>
            <span className="menu-item-name">{menuItem.name}</span>
            {
                showDescriptions
                && menuItem.description
                && <span className="menu-item-description">{menuItem.description}</span>
            }
        </div>
    );
};
