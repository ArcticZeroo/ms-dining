import React from 'react';
import { ICafeStation } from '../../../models/cafe.ts';
import { IMenuItem } from '@msdining/common/models/cafe';

interface IIngredientsMenu {
    starterChoices: IMenuItem[];
    mainChoices: IMenuItem[];
    dessertChoices: IMenuItem[];
    mocktailOffering?: IMenuItem[];
    additionalOfferings: IMenuItem[];
}

export const parseIngredientsMenu = (stations: ICafeStation[]): IIngredientsMenu | null => {
    if (stations.length !== 1) {
        return null;
    }

    const station = stations[0]!;
    const threeCourseMealMenuItems = station.menu['3 Course Meal'];

    if (!threeCourseMealMenuItems || threeCourseMealMenuItems.length === 0) {
        return null;
    }

    const starterChoiceModifier = threeCourseMealMenuItems[0]!.modifiers.find(modifier => modifier.description.includes('Starter Choice'));
    const dessertChoiceModifier = threeCourseMealMenuItems[0]!.modifiers.find(modifier => modifier.description.includes('Dessert Choice'));

    if (!starterChoiceModifier || !dessertChoiceModifier) {
        return null;
    }

    return {
        mainChoices: threeCourseMealMenuItems,
        starterChoices: [],
        dessertChoices: [],
        mocktailOffering: [],
        additionalOfferings: [],
    }
}

interface IMenuForIngredientsProps {
    menu: IIngredientsMenu;
}

export const IngredientsMenuView: React.FC<IMenuForIngredientsProps> = ({ menu }) => {
    return (
        <div className="ingredients-menu-view">
            <h2>Ingredients Menu</h2>
            <div className="menu-section">
                <h3>Starters</h3>
                <ul>
                    {menu.starterChoices.map(item => (
                        <li key={item.id}>{item.name}</li>
                    ))}
                </ul>
            </div>
            <div className="menu-section">
                <h3>Main Courses</h3>
                <ul>
                    {menu.mainChoices.map(item => (
                        <li key={item.id}>{item.name}</li>
                    ))}
                </ul>
            </div>
            <div className="menu-section">
                <h3>Desserts</h3>
                <ul>
                    {menu.dessertChoices.map(item => (
                        <li key={item.id}>{item.name}</li>
                    ))}
                </ul>
            </div>
            {menu.mocktailOffering && menu.mocktailOffering.length > 0 && (
                <div className="menu-section">
                    <h3>Mocktails</h3>
                    <ul>
                        {menu.mocktailOffering.map(item => (
                            <li key={item.id}>{item.name}</li>
                        ))}
                    </ul>
                </div>
            )}
            {menu.additionalOfferings.length > 0 && (
                <div className="menu-section">
                    <h3>Additional Offerings</h3>
                    <ul>
                        {menu.additionalOfferings.map(item => (
                            <li key={item.id}>{item.name}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}