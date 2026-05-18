import { ISearchQuery } from '@msdining/common/models/search';
import { getFridayForWeek, getMondayForWeek, isDateInRangeInclusive } from '@msdining/common/util/date-util';
import React, { useMemo } from 'react';
import { useSelectedDate } from '../../../../store/zustand/selected-date.ts';
import { RetryButton } from '../../../button/retry-button.tsx';
import { HomeFavoriteResult } from './home-favorite-result.tsx';
import { SearchResultSkeleton } from '../../../search/search-result-skeleton.tsx';
import { HomeCollapse } from '../home-collapse.tsx';
import { ApplicationSettings } from '../../../../constants/settings.ts';
import { useTitleWithSelectedDate } from '../../../../hooks/string.ts';
import { useFavoriteSearchResults } from '../../../../hooks/favorites.js';

interface IHomeFavoritesViewProps {
    queries: ISearchQuery[];
}

export const HomeFavoritesView: React.FC<IHomeFavoritesViewProps> = ({ queries }) => {
    const selectedDate = useSelectedDate();
    const title = useTitleWithSelectedDate('Favorites Across Campus');

    const { isPending, isError, results, retry } = useFavoriteSearchResults(queries);

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
        if (isPending || !results) {
            return (
                <div id="home-favorites-results">
                    <SearchResultSkeleton
                        isCompact={true}
                        showFavoriteButton={true}
                    />
                </div>
            );
        }

        if (isError) {
            return (
                <div className="error-card">
                    <span>
                        Could not load favorites.
                    </span>
                    <span className="centered-content">
                        <RetryButton onClick={retry}/>
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
    }, [isPending, isError, results, retry, selectedDate]);

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