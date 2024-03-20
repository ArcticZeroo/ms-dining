import { normalizeNameForSearch } from '@msdining/common/dist/util/search-util';
import React from 'react';
import { IMenuItemsByCategoryName } from '../../../../models/cafe.ts';
import { MenuCategory } from './menu-category.tsx';

interface IStationMenuProps {
    normalizedStationName: string;
    menuItemsByCategoryName: IMenuItemsByCategoryName;
}

const StationMenuWithRef: React.ForwardRefRenderFunction<HTMLDivElement, IStationMenuProps> = ({
    menuItemsByCategoryName,
    normalizedStationName
}, menuBodyRef) => {
    return (
        // This div wrapper is needed for the table to scroll independently of the header
        <div className="menu-body" ref={menuBodyRef}>
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