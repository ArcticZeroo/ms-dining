import { PromiseStage } from '@arcticzeroo/react-promise-hook';
import { ISearchQuery } from '@msdining/common/models/search';
import { getFridayForWeek, getMondayForWeek, isDateInRangeInclusive } from '@msdining/common/util/date-util';
import React, { useMemo } from 'react';
import { SelectedDateContext } from '../../../../context/time.ts';
import { useValueNotifierContext } from '../../../../hooks/events.ts';
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