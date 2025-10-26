import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { ISearchQuery } from '@msdining/common/models/search';
import { getFridayForWeek, getMondayForWeek, isDateInRangeInclusive } from '@msdining/common/util/date-util';
import React, { useCallback, useEffect, useMemo } from 'react';
import { DiningClient } from '../../../../api/dining.ts';
import { SelectedDateContext } from '../../../../context/time.ts';
import { useDateForSearch } from '../../../../hooks/date-picker.tsx';
import { useValueNotifierContext } from '../../../../hooks/events.ts';
import { IQuerySearchResult } from '../../../../models/search.ts';
import { MenusCurrentlyUpdatingException } from '../../../../util/exception.ts';
import { isAnyDateToday } from '../../../../util/search.ts';
import { RetryButton } from '../../../button/retry-button.tsx';
import { HomeFavoriteResult } from './home-favorite-result.tsx';
import { SearchResultSkeleton } from '../../../search/search-result-skeleton.tsx';
import { HomeCollapse } from '../home-collapse.tsx';
import { ApplicationSettings } from '../../../../constants/settings.ts';
import { useTitleWithSelectedDate } from '../../../../hooks/string.ts';

interface IFavoriteSearchResultsData {
    stage: PromiseStage;
    results?: IQuerySearchResult[];
    error?: unknown;
    actualStage: PromiseStage;
    retry: () => void;
}

const useFavoriteSearchResults = (queries: ISearchQuery[]): IFavoriteSearchResultsData => {
    const selectedDate = useValueNotifierContext(SelectedDateContext);
    const dateForSearch = useDateForSearch();

    const retrieveFavoriteSearchResults = useCallback(async () => {
        if (queries.length === 0) {
            return [];
        }

        return DiningClient.retrieveFavoriteSearchResults(queries, dateForSearch);
    }, [queries, dateForSearch]);

    const { stage, value, actualStage, error, run } = useDelayedPromiseState(
        retrieveFavoriteSearchResults,
        true /*keepLastValue*/
    );

    useEffect(() => {
        run();
    }, [run]);

    const filteredResults = useMemo(
        () => {
            return value?.filter(item => isAnyDateToday(item.locationDatesByCafeId, selectedDate));
        },
        [value, selectedDate]
    );

    return { stage, results: filteredResults, actualStage, error, retry: run };
};

interface IHomeFavoritesViewProps {
    queries: ISearchQuery[];
}

export const HomeFavoritesView: React.FC<IHomeFavoritesViewProps> = ({ queries }) => {
    const selectedDate = useValueNotifierContext(SelectedDateContext);
    const title = useTitleWithSelectedDate('Favorites Across Campus');

    const { stage, results, actualStage, error, retry } = useFavoriteSearchResults(queries);

    const areFavoritesAllowedForSelectedDay = useMemo(
        () => {
            const now = new Date();
            const monday = getMondayForWeek(now);
            const friday = getFridayForWeek(now);
            return isDateInRangeInclusive(selectedDate, [monday, friday]);
        },
        [selectedDate]
    );

    const bodyView = useMemo(() => {
        if (!results || stage === PromiseStage.running) {
            return (
                <div id="home-favorites-results">
                    <SearchResultSkeleton
                        isCompact={true}
                        showFavoriteButton={true}
                    />
                </div>
            );
        }

        if (stage === PromiseStage.error) {
            return (
                <div className="error-card">
                    <span>
                        Could not load favorites.
                        {
                            error instanceof MenusCurrentlyUpdatingException && (
                                ' Menus are currently updating. Please try again soon!'
                            )
                        }
                    </span>
                    <span className="centered-content">
                        <RetryButton onClick={retry} isDisabled={actualStage !== PromiseStage.error}/>
                    </span>
                </div>
            );
        }

        if (results.length === 0) {
            return (
                <div className="centered-content">
                    Nothing here today!
                </div>
            );
        }

        return (
            <div id="home-favorites-results">
                {
                    results.map(result => (
                        <HomeFavoriteResult
                            key={result.name}
                            result={result}
                            date={selectedDate}
                        />
                    ))
                }
            </div>
        );
    }, [stage, results, error, actualStage, retry, selectedDate]);

    if (!areFavoritesAllowedForSelectedDay) {
        return null;
    }

    return (
        <HomeCollapse
            title={title}
            id="home-favorites"
            featureToggle={ApplicationSettings.showFavoritesOnHome}
        >
            {bodyView}
        </HomeCollapse>
    );
};