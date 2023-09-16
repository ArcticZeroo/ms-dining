import { IDiningHallMenuItemsByCategoryName } from '../../../models/dining-halls.ts';
import React from 'react';
import { MenuCategory } from './menu-category.tsx';

interface IDiningHallConceptMenuProps {
    menuItemsByCategoryName: IDiningHallMenuItemsByCategoryName;
}

export const ConceptMenu: React.FC<IDiningHallConceptMenuProps> = ({ menuItemsByCategoryName }) => {
    return (
        // This div wrapper is needed for the table to scroll independently of the header
        <div className="menu-body">
            <table>
                <tbody>
                {
                    Object.keys(menuItemsByCategoryName).map(categoryName => (
                        <MenuCategory key={categoryName} categoryName={categoryName} menuItems={menuItemsByCategoryName[categoryName]}/>
                    ))
                }
                </tbody>
            </table>
        </div>
    )
};