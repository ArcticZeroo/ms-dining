import { ICheapItemSearchResult } from '../../../models/search.ts';
import React from 'react';
import { SearchResult } from '../../search/search-result.tsx';
import { SearchTypes } from '@msdining/common';
import { formatPrice } from '../../../util/cart.ts';

const getAverageCalories = (item: ICheapItemSearchResult) => {
    if (item.minCalories === 0 && item.maxCalories === 0) {
        return undefined;
    }

    return (item.minCalories + item.maxCalories) / 2;
}

interface ICheapItemResultProps {
    item: ICheapItemSearchResult;
}

export const CheapItemResult: React.FC<ICheapItemResultProps> = ({ item }) => {
    const averageCalories = getAverageCalories(item);
    const averageCaloriesPerDollar = averageCalories ? averageCalories / item.price : undefined;

    const caloriesDisplay = averageCalories
        ? `${averageCalories} calories (average)`
        : 'Unknown calories';
    const caloriesPerDollarDisplay = averageCaloriesPerDollar
        ? `${Math.floor(averageCaloriesPerDollar)} calories per dollar`
        : 'Unknown calories per dollar';

    return (
        <SearchResult
            isVisible={true}
            name={item.name}
            description={item.description}
            locationDatesByCafeId={item.locationDatesByCafeId}
            imageUrl={item.imageUrl}
            entityType={SearchTypes.SearchEntityType.menuItem}
            extraFields={[
                {
                    key:      'price',
                    iconName: 'attach_money',
                    value:    item.price && formatPrice(item.price, false /*addCurrencySign*/),
                },
                {
                    key:      'calories',
                    iconName: 'local_fire_department',
                    value:    caloriesDisplay
                },
                {
                    key:      'calories-per-dollar',
                    iconName: 'calculate',
                    value:    caloriesPerDollarDisplay
                },
            ]}
        />
    );
};