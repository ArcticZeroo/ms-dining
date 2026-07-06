import { IMenuItem, IMenuItemBase } from '@msdining/common/models/cafe';
import React from 'react';
import { ApplicationSettings } from '../../../../constants/settings.ts';
import { useValueNotifier } from '../../../../hooks/events.ts';
import { formatPrice, getMinRequiredPrice, hasModifierPriceBeyondMinimum } from '../../../../util/cart.ts';

const getCaloriesDisplay = (menuItem: IMenuItemBase) => {
    if (!menuItem.calories || Number(menuItem.calories) < 1) {
        return false;
    }

    const parts = [menuItem.calories];
    if (menuItem.maxCalories && Number(menuItem.maxCalories) > 0) {
        parts.push(menuItem.maxCalories);
    }

    return `${parts.join(' - ')} Calories`;
};

interface IMenuItemPriceProps {
    menuItem: IMenuItem;
}

export const MenuItemPrice: React.FC<IMenuItemPriceProps> = ({ menuItem }) => {
    const showCalories = useValueNotifier(ApplicationSettings.showCalories);
    const showModifierMinPrice = useValueNotifier(ApplicationSettings.showModifierMinPrice);

    const caloriesDisplay = getCaloriesDisplay(menuItem);

    return (
        <div className="flex">
            <span>
                {formatPrice(showModifierMinPrice ? getMinRequiredPrice(menuItem) : menuItem.price)}
                {showModifierMinPrice && hasModifierPriceBeyondMinimum(menuItem) && '+'}
            </span>
            {
                showCalories && (
                    <span>
                        {caloriesDisplay}
                    </span>
                )
            }
        </div>
    );
};
