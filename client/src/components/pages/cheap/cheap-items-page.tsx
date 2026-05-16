import React, { useEffect, useMemo } from 'react';
import { useDateForSearch } from '../../../hooks/date-picker.tsx';
import { useValueNotifier, useValueNotifierContext } from '../../../hooks/events.ts';
import { ICheapItemSearchResult } from '../../../models/search.ts';
import { isSearchResultVisible } from '../../../util/search.ts';
import { CheapItemResult } from './cheap-item-result.tsx';
import { SelectedDateContext } from '../../../context/time.ts';
import { setPageData } from '../../../util/title.ts';
import { ApplicationSettings } from '../../../constants/settings.ts';
import { RetryButton } from '../../button/retry-button.tsx';
import { SearchResultSkeleton } from '../../search/search-result-skeleton.tsx';
import { SearchWaiting } from "../../search/search-waiting.tsx";
import { useCheapItemsQuery } from '../../../store/queries/search.ts';

interface ICheapItemsResults {
    isPending: boolean;
    isError: boolean;
    error: unknown;
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

    const { isPending, isError, error, data, refetch } = useCheapItemsQuery(searchDate);

    const filteredResults = useMemo(
        () => {
            if (!data) {
                return [];
            }

            if (allowFutureMenus && !enablePriceFilters) {
                return data;
            }

            const filteredResults: ICheapItemSearchResult[] = [];

            for (const item of data) {
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
        [data, allowFutureMenus, enablePriceFilters, minPrice, maxPrice, selectedDate]
    );

    const sortedResults = useMemo(() => {
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
        isPending,
        isError,
        error,
        results: sortedResults,
        retry:   () => {
            void refetch();
        },
    };
}

export const CheapItemsPage: React.FC = () => {
    const { isPending, isError, results, error, retry } = useCheapItems();

    useEffect(() => {
        setPageData('Cheap Items', 'View a leaderboard of all menu items offered today at the Microsoft Redmond Campus by calories per dollar');
    }, []);

    if (isError) {
        return (
            <div className="error-card">
                Could not load cheap items.
                <br/>
                {String(error)}
                <RetryButton onClick={retry}/>
            </div>
        );
    }

    return (
        <div className="search-page">
            <div className="search-info default-border-radius">
                <div className="query default-container flex flex-between">
                    <span className="icon-sized number-badge">
                        {isPending ? '?' : results.length}
                    </span>
                    <span>
                        Cheap Items
                    </span>
                    <SearchWaiting isPending={isPending}/>
                </div>
            </div>
            <div className="flex-col">
                {isPending && <SearchResultSkeleton/>}
                {
                    results.map(result => (
                        <CheapItemResult key={`${result.name} ${result.price}`} item={result}/>
                    ))
                }
            </div>
        </div>
    );
}