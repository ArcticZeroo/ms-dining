import { normalizeNameForSearch } from '@msdining/common/dist/util/search-util';
import React from 'react';
import { ICafeStation, MenuItemsByCategoryName } from '../../../../models/cafe.ts';
import { StationTheme } from '../station-theme.tsx';
import { MenuCategory } from './menu-category.tsx';
import { StationFirstVisit } from '../station-first-visit.tsx';

interface IStationMenuProps {
    station: ICafeStation;
    normalizedStationName: string;
    menuItemsByCategoryName: MenuItemsByCategoryName;
}

export const StationMenu: React.FC<IStationMenuProps> = ({
    station,
    menuItemsByCategoryName,
    normalizedStationName,
}) => {
    return (
        // This div wrapper is needed for the table to scroll independently of the header
        <div className="menu-body">
            <StationFirstVisit firstVisit={station.uniqueness.firstAppearance} />
            <StationTheme theme={station.uniqueness.theme}/>
            <div className="flex flex-wrap">
                {
                    Object.entries(menuItemsByCategoryName).map(([categoryName, menuItems], i) => {
                        const shouldSkipCategoryName = (
                            i === 0
                            && normalizeNameForSearch(categoryName) === normalizedStationName
                        );

                        return (
                            <MenuCategory key={categoryName}
                                categoryName={shouldSkipCategoryName ? undefined : categoryName}
                                menuItems={menuItems}
                            />
                        );
                    })
                }
            </div>
        </div>
    );
};