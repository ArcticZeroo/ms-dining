import { normalizeNameForSearch } from '@msdining/common/dist/util/search-util';
import React from 'react';
import { MenuItemsByCategoryName } from '../../../../models/cafe.ts';
import { StationTheme } from '../station-theme.tsx';
import { MenuCategory } from './menu-category.tsx';

interface IStationMenuProps {
    normalizedStationName: string;
    menuItemsByCategoryName: MenuItemsByCategoryName;
    theme: string | undefined;
}

const StationMenuWithRef: React.ForwardRefRenderFunction<HTMLDivElement, IStationMenuProps> = ({
    menuItemsByCategoryName,
    normalizedStationName,
    theme
}, menuBodyRef) => {
    return (
        // This div wrapper is needed for the table to scroll independently of the header
        <div className="menu-body" ref={menuBodyRef}>
            <StationTheme theme={theme}/>
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
    );
};

export const StationMenu = React.forwardRef(StationMenuWithRef);