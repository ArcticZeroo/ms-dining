import { IDiningHallMenuItemsByCategoryName } from '../../../../models/dining-halls.ts';
import React from 'react';
import { MenuCategory } from './menu-category.tsx';

interface IDiningHallConceptMenuProps {
    menuItemsByCategoryName: IDiningHallMenuItemsByCategoryName;
}

export const Menu: React.FC<IDiningHallConceptMenuProps> = ({ menuItemsByCategoryName }) => {
    return (
        <table className="menu-body">
            {
                Object.keys(menuItemsByCategoryName).map(categoryName => (
                    <MenuCategory key={categoryName} categoryName={categoryName} menuItems={menuItemsByCategoryName[categoryName]}/>
                ))
            }
        </table>
    )
};