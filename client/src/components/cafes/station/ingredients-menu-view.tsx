import React from 'react';
import { IMenuItem } from '@msdining/common/models/cafe';
import { formatPrice } from '../../../util/cart.ts';
import type { Nullable } from '@msdining/common/models/util';
import { CourseMenuSection } from './course-menu-section.tsx';
import { IngredientsInfoBanner } from './ingredients-info-banner.tsx';
import './ingredients-menu-view.css';

interface IIngredientsMenu {
    price: number;
    logoUrl: Nullable<string>;
    starterChoices: IMenuItem[];
    entreeChoices: IMenuItem[];
    dessertChoices: IMenuItem[];
    drinkChoices: IMenuItem[];
    sideChoices: IMenuItem[];
    otherItems: IMenuItem[];
}

interface IMenuForIngredientsProps {
    menu: IIngredientsMenu;
}

export const IngredientsMenuView: React.FC<IMenuForIngredientsProps> = ({ menu }) => {
    return (
        <div className="ingredients-menu-view station">
            <IngredientsInfoBanner/>
            <div className="ingredients-price-callout">
                {formatPrice(menu.price)} for a 3-course meal (starter + entrée + dessert)
            </div>
            <CourseMenuSection
                title="Starters"
                subtitle="Choose one with your meal"
                items={menu.starterChoices}
            />
            <CourseMenuSection
                title="Entrées"
                subtitle="Choose one"
                items={menu.entreeChoices}
            />
            <CourseMenuSection
                title="Desserts"
                subtitle="Choose one with your meal"
                items={menu.dessertChoices}
            />
            <CourseMenuSection
                title="Drinks"
                subtitle="Available à la carte"
                items={menu.drinkChoices}
            />
            <CourseMenuSection
                title="Sides"
                subtitle="Available à la carte"
                items={menu.sideChoices}
            />
            <CourseMenuSection
                title="Other Items"
                subtitle="Available à la carte"
                items={menu.otherItems}
            />
        </div>
    );
};