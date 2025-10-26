import { PromiseStage, useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import React, { useCallback, useEffect, useMemo } from 'react';
import { DiningClient } from '../../../api/client/dining.ts';
import { useDateForSearch } from '../../../hooks/date-picker.tsx';
import { useValueNotifier, useValueNotifierContext } from '../../../hooks/events.ts';
import { ICheapItemSearchResult } from '../../../models/search.ts';
import { isSearchResultVisible } from '../../../util/search.ts';
import { CheapItemResult } from './cheap-item-result.tsx';
import { SelectedDateContext } from '../../../context/time.ts';
import { setPageData } from '../../../util/title.ts';
import { ApplicationSettings } from '../../../constants/settings.ts';
import { MenusCurrentlyUpdatingException } from '../../../util/exception.ts';
import { RetryButton } from '../../button/retry-button.tsx';
import { SearchResultSkeleton } from '../../search/search-result-skeleton.tsx';
import { SearchWaiting } from "../../search/search-waiting.tsx";

interface ICheapItemsResults {
    stage: PromiseStage;
    error?: unknown;
    results: ICheapItemSearchResult[];
    retry: () => void;
}

const useCheapItems = (): ICheapItemsResults => {
    const allowFutureMenus = useValueNotifier(ApplicationSettings.allowFutureMenus);
    const selectedDate = useValueNotifierContext(SelectedDateContext);
    const searchDate = useDateForSearch();
    const enablePriceFilters = useValueNotifier(ApplicationSettings.enablePriceFilters);
    const minPrice = useValueNotifier(ApplicationSettings.minimumPrice);
    const maxPrice = useValueNotifier(ApplicationSettings.maximumPrice);

    const retrieveCheapItems = useCallback(
        () => DiningClient.retrieveCheapItems(searchDate),
        [searchDate]
    );

    const { stage, value: results, error, run } = useImmediatePromiseState(retrieveCheapItems);

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
        retry: run
    };
}

export const CheapItemsPage: React.FC = () => {
    const { stage, results, error, retry } = useCheapItems();

    useEffect(() => {
        setPageData('Cheap Items', 'View a leaderboard of all menu items offered today at the Microsoft Redmond Campus by calories per dollar');
    }, []);

    if (stage === PromiseStage.error) {
        return (
            <div className="error-card">
                Could not load cheap items.
                <br/>
                {String(error)}
                {
                    (error != null && error instanceof MenusCurrentlyUpdatingException) && (
                        <>
                            <br/>
                            Menus are currently updating. Please try again soon!
                            <br/>
                        </>
                    )
                }
                <RetryButton onClick={retry}/>
            </div>
        );
    }

    return (
        <div className="search-page">
            <div className="search-info default-border-radius">
                <div className="query default-container flex flex-between">
                    <span className="icon-sized badge">
                        {
                            stage === PromiseStage.success
                                ? results.length
                                : '?'
                        }
                    </span>
                    <span>
                        Cheap Items
                    </span>
                    <SearchWaiting stage={stage}/>
                </div>
            </div>
            <div className="flex-col">
                {
                    stage === PromiseStage.running && (
                        <SearchResultSkeleton/>
                    )
                }
                {
                    results.map(result => (
                        <CheapItemResult key={`${result.name} ${result.price}`} item={result}/>
                    ))
                }
            </div>
        </div>
    );
}