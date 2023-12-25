import { PromiseStage, useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import React, { useMemo } from 'react';
import { DiningClient } from '../../../api/dining.ts';
import { ApplicationSettings } from '../../../api/settings.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { ICheapItemSearchResult } from '../../../models/search.ts';
import { isSearchResultVisible } from '../../../util/search.ts';
import { SearchWaiting } from '../../search/search-waiting.tsx';
import { CheapItemResult } from './cheap-item-result.tsx';

const isMissingCalories = (item: ICheapItemSearchResult) => item.minCalories === 0 && item.maxCalories === 0;

const useCheapItems = () => {
    const allowFutureMenus = useValueNotifier(ApplicationSettings.allowFutureMenus);
    const { stage, value: results, error } = useImmediatePromiseState(DiningClient.retrieveCheapItems);

    const filteredResults = useMemo(
        () => {
            if (!results) {
                return [];
            }

            if (allowFutureMenus) {
                return results;
            }

            const filteredResults: ICheapItemSearchResult[] = [];

            for (const item of results) {
                if (isMissingCalories(item)) {
                    continue;
                }

                if (!isSearchResultVisible(item.locationDatesByCafeId, allowFutureMenus)) {
                    continue;
                }

                filteredResults.push(item);
            }

            return filteredResults;
        },
        [results, allowFutureMenus]
    );

    const sortedResults = useMemo(() => {
        if (!filteredResults) {
            return [];
        }

        const newSortedResults = [...filteredResults];

        return newSortedResults.sort((a, b) => {
            const averageCaloriesA = (a.minCalories + a.maxCalories) / 2;
            const averageCaloriesB = (b.minCalories + b.maxCalories) / 2;

            const caloriesPerDollarA = averageCaloriesA / a.price;
            const caloriesPerDollarB = averageCaloriesB / b.price;

            return caloriesPerDollarB - caloriesPerDollarA;
        });
    }, [filteredResults]);

    return {
        stage,
        error,
        results: sortedResults,
    };
}

export const CheapItemsPage: React.FC = () => {
    const { stage, results, error } = useCheapItems();

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
                    <div>
                        Sorted by Calories per Dollar (Descending)
                    </div>
                </div>
                <SearchWaiting stage={stage}/>
            </div>
            <div className="search-results">
                {
                    items.map(item => (
                        <CheapItemResult key={`${item.name} ${item.price}`} item={item}/>
                    ))
                }
            </div>
        </div>
    );
}