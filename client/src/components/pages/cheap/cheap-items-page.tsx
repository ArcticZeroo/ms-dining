import React, { useMemo, useState } from 'react';
import { PromiseStage, useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { DiningClient } from '../../../api/dining.ts';
import { SearchWaiting } from '../../search/search-waiting.tsx';
import { CheapItemsSortType } from '../../../models/search.ts';
import { SortButton } from './sort-button.tsx';
import { CheapItemResult } from './cheap-item-result.tsx';

const useCheapItems = (sortType: CheapItemsSortType) => {
    const { stage, value, error } = useImmediatePromiseState(DiningClient.retrieveCheapItems);

    const sortedResults = useMemo(() => {
        if (!value) {
            return [];
        }

        switch (sortType) {
            case CheapItemsSortType.priceAsc:
                return value.sort((a, b) => a.price - b.price);
            case CheapItemsSortType.priceDesc:
                return value.sort((a, b) => b.price - a.price);
            case CheapItemsSortType.caloriesPerDollarDesc:
                return value.sort((a, b) => {
                    const isMissingCaloriesA = a.minCalories === 0 && a.maxCalories === 0;
                    const isMissingCaloriesB = b.minCalories === 0 && b.maxCalories === 0;

                    if (isMissingCaloriesA && isMissingCaloriesB) {
                        return a.price - b.price;
                    }

                    // Push to end of list if we have no calories
                    if (isMissingCaloriesA) {
                        return 1;
                    }

                    if (isMissingCaloriesB) {
                        return -1;
                    }

                    const averageCaloriesA = (a.minCalories + a.maxCalories) / 2;
                    const averageCaloriesB = (b.minCalories + b.maxCalories) / 2;

                    const caloriesPerDollarA = averageCaloriesA / a.price;
                    const caloriesPerDollarB = averageCaloriesB / b.price;

                    return caloriesPerDollarB - caloriesPerDollarA;
                });
            case CheapItemsSortType.relevance:
                // TODO
                return value;
        }
    }, [value, sortType]);

    return {
        stage,
        error,
        results: sortedResults,
    };
}

export const CheapItemsPage: React.FC = () => {
    const [sortType, setSortType] = useState(CheapItemsSortType.caloriesPerDollarDesc);
    const { stage, results, error } = useCheapItems(sortType);

    if (stage === PromiseStage.error) {
        return (
            <div className="error-card">
                Could not load cheap items.
                <br/>
                {String(error)}
            </div>
        );
    }

    const items = results ?? [];

    return (
        <div className="search-page">
            <div className="search-info">
                <div>
                    <div className="search-result-count">
                        Total Results: {items.length}
                    </div>
                </div>
                <SearchWaiting stage={stage}/>
            </div>
            <div className="search-filter-selector">
                <SortButton
                    name="Calories per Dollar Ascending"
                    currentSort={sortType}
                    type={CheapItemsSortType.caloriesPerDollarDesc}
                    onClick={() => setSortType(CheapItemsSortType.caloriesPerDollarDesc)}
                />
                <SortButton
                    name="Price Ascending"
                    currentSort={sortType}
                    type={CheapItemsSortType.priceAsc}
                    onClick={() => setSortType(CheapItemsSortType.priceAsc)}
                />
                <SortButton
                    name="Price Descending"
                    currentSort={sortType}
                    type={CheapItemsSortType.priceDesc}
                    onClick={() => setSortType(CheapItemsSortType.priceDesc)}
                />
                {/*<SortButton*/}
                {/*    name="Relevance"*/}
                {/*    currentSort={sortType}*/}
                {/*    type={CheapItemsSortType.relevance}*/}
                {/*    onClick={() => setSortType(CheapItemsSortType.relevance)}*/}
                {/*/>*/}
            </div>
            <div className="search-results">
                {
                    items.map(item => (
                        <CheapItemResult key={item.name} item={item}/>
                    ))
                }
            </div>
        </div>
    );
}