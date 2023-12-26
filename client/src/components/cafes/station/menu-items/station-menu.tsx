import { IMenuItemsByCategoryName } from '../../../../models/cafe.ts';
import React from 'react';
import { MenuCategory } from './menu-category.tsx';

interface IStationMenuProps {
    menuItemsByCategoryName: IMenuItemsByCategoryName;
}

const StationMenuWithRef: React.ForwardRefRenderFunction<HTMLDivElement, IStationMenuProps> = ({ menuItemsByCategoryName }, menuBodyRef) => {
    return (
        // This div wrapper is needed for the table to scroll independently of the header
        <div className="menu-body" ref={menuBodyRef}>
            <table>
                <tbody>
                    {
                        Object.keys(menuItemsByCategoryName).map(categoryName => (
                            <MenuCategory key={categoryName}
                                categoryName={categoryName}
                                menuItems={menuItemsByCategoryName[categoryName]}/>
                        ))
                    }
                </tbody>
            </table>
        </div>
    );
};

export const StationMenu = React.forwardRef(StationMenuWithRef);