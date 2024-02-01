import { PromiseStage, useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import React, { useEffect, useMemo } from 'react';
import { DiningClient } from '../../../api/dining.ts';
import { ApplicationSettings } from '../../../api/settings.ts';
import { useValueNotifier, useValueNotifierContext } from '../../../hooks/events.ts';
import { ICheapItemSearchResult } from '../../../models/search.ts';
import { isSearchResultVisible } from '../../../util/search.ts';
import { SearchWaiting } from '../../search/search-waiting.tsx';
import { CheapItemResult } from './cheap-item-result.tsx';
import { SelectedDateContext } from '../../../context/time.ts';
import { setPageData } from '../../../util/title.ts';

const useCheapItems = () => {
    const allowFutureMenus = useValueNotifier(ApplicationSettings.allowFutureMenus);
    const selectedDate = useValueNotifierContext(SelectedDateContext);
    const enablePriceFilters = useValueNotifier(ApplicationSettings.enablePriceFilters);
    const minPrice = useValueNotifier(ApplicationSettings.minimumPrice);
    const maxPrice = useValueNotifier(ApplicationSettings.maximumPrice);

    const { stage, value: results, error } = useImmediatePromiseState(DiningClient.retrieveCheapItems);

    const filteredResults = useMemo(
        () => {
            if (!results) {
                return [];
            }

            if (allowFutureMenus && !enablePriceFilters) {
                return results;
            }

            const filteredResults: ICheapItemSearchResult[] = [];

            for (const item of results) {
                if (enablePriceFilters && (item.price < minPrice || item.price > maxPrice)) {
                    continue;
                }

                if (!isSearchResultVisible(item.locationDatesByCafeId, allowFutureMenus, selectedDate)) {
                    continue;
                }

                filteredResults.push(item);
            }

            return filteredResults;
        },
        [results, allowFutureMenus, enablePriceFilters, minPrice, maxPrice, selectedDate]
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

    useEffect(() => {
        setPageData('Cheap Items', 'View a leaderboard of all menu items offered today at the Microsoft Redmond Campus by calories per dollar');
    }, []);

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