import React from 'react';
import { IMenuItem } from '@msdining/common/models/cafe';
import { formatPrice } from '../../../util/cart.ts';
import { MenuItem } from './menu-items/menu-item.tsx';
import { IIngredientsMenu } from './ingredients-menu-parsing.ts';
import './ingredients-menu-view.css';

interface ICourseMenuSectionProps {
    title: string;
    subtitle?: string;
    items: IMenuItem[];
}

const CourseMenuSection: React.FC<ICourseMenuSectionProps> = ({ title, subtitle, items }) => {
    if (items.length === 0) {
        return null;
    }

    return (
        <div className="ingredients-course-section">
            <div className="ingredients-course-header">
                <h3 className="ingredients-course-title">{title}</h3>
                {subtitle && <span className="ingredients-course-subtitle">{subtitle}</span>}
            </div>
            <div className="menu-category-items">
                {items.map(item => (
                    <MenuItem key={item.id} menuItem={item}/>
                ))}
            </div>
        </div>
    );
};

interface IMenuForIngredientsProps {
    menu: IIngredientsMenu;
}

export const IngredientsInfoBanner: React.FC = () => (
    <div className="card default-margin-bottom ingredients-info-banner">
        <span className="material-symbols-outlined">info</span>
        <span>
            in.gredients is a 3-course restaurant inside Café 34.
            Reservations are generally required, but you may be able to get a walk-up table if you&apos;re lucky.
            There are bar seats over by the salad bar that can&apos;t be reserved and are easier to get without a reservation.
        </span>
    </div>
);

export const IngredientsMenuView: React.FC<IMenuForIngredientsProps> = ({ menu }) => {
    return (
        <div className="ingredients-menu-view">
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
                items={menu.mainChoices}
            />
            <CourseMenuSection
                title="Desserts"
                subtitle="Choose one with your meal"
                items={menu.dessertChoices}
            />
            <CourseMenuSection
                title="Additional Offerings"
                subtitle="Available à la carte"
                items={menu.additionalOfferings}
            />
        </div>
    );
};