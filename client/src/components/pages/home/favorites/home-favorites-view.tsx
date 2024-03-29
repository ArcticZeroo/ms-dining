import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { ISearchQuery } from '@msdining/common/dist/models/search';
import { getNowWithDaysInFuture, isSameDate, yieldDaysInFutureForThisWeek } from '@msdining/common/dist/util/date-util';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DiningClient } from '../../../../api/dining.ts';
import { ApplicationContext } from '../../../../context/app.ts';
import { SelectedDateContext } from '../../../../context/time.ts';
import { useValueNotifierContext } from '../../../../hooks/events.ts';
import { useHomepageViews } from '../../../../hooks/views.ts';
import { IQuerySearchResult } from '../../../../models/search.ts';
import { MenusCurrentlyUpdatingException } from '../../../../util/exception.ts';
import { classNames } from '../../../../util/react.ts';
import { isAnyDateToday } from '../../../../util/search.ts';
import { expandAndFlattenView } from '../../../../util/view.ts';
import { RetryButton } from '../../../button/retry-button.tsx';
import { ExpandIcon } from '../../../icon/expand.tsx';
import { HourglassLoadingSpinner } from '../../../icon/hourglass-loading-spinner.tsx';
import { HomeFavoriteResult } from './home-favorite-result.tsx';

interface IFavoriteSearchResultsData {
    stage: PromiseStage;
    results: IQuerySearchResult[];
    error?: unknown;
    actualStage: PromiseStage;
    retry: () => void;
}

const useFavoriteSearchResults = (queries: ISearchQuery[]): IFavoriteSearchResultsData => {
    const selectedDate = useValueNotifierContext(SelectedDateContext);

    const retrieveFavoriteSearchResults = useCallback(async () => {
        if (queries.length === 0) {
            return [];
        }

        return DiningClient.retrieveFavoriteSearchResults(queries);
    }, [queries]);

    const { stage, value, actualStage, error, run } = useDelayedPromiseState(
        retrieveFavoriteSearchResults,
        true /*keepLastValue*/
    );

    useEffect(() => {
        run();
    }, [run]);

    const filteredResults = useMemo(
        () => {
            const results = value ?? [];
            return results.filter(item => isAnyDateToday(item.locationDatesByCafeId, selectedDate));
        },
        [value, selectedDate]
    );

    return { stage, results: filteredResults, actualStage, error, retry: run };
};

interface IHomeFavoritesViewProps {
    queries: ISearchQuery[];
}

export const HomeFavoritesView: React.FC<IHomeFavoritesViewProps> = ({ queries }) => {
    const { viewsById } = useContext(ApplicationContext);
    const homepageViews = useHomepageViews();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const selectedDate = useValueNotifierContext(SelectedDateContext);

    const cafeIdsOnPage = useMemo(
        () => new Set(
            Array.from(homepageViews.values())
                .flatMap(viewId => expandAndFlattenView(viewId, viewsById))
                .map(cafe => cafe.id)
        ),
        [homepageViews, viewsById]
    );

    const onToggleExpansion = () => {
        setIsCollapsed(!isCollapsed);
    };

    const { stage, results, actualStage, error, retry } = useFavoriteSearchResults(queries);

    const shouldHideFavorites = useMemo(
        () => {
            // favorites search only allows you to search for items this week
            for (const daysInFuture of yieldDaysInFutureForThisWeek()) {
                if (isSameDate(getNowWithDaysInFuture(daysInFuture), selectedDate)) {
                    return false;
                }
            }

            return true;
        },
        [selectedDate]
    );

    const bodyView = useMemo(() => {
        if (stage === PromiseStage.running) {
            return (
                <div className="centered-content">
                    <HourglassLoadingSpinner/>
                    Loading favorites...
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
                            cafeIdsOnPage={cafeIdsOnPage}
                        />
                    ))
                }
            </div>
        );
    }, [stage, results, error, actualStage, retry, selectedDate, cafeIdsOnPage]);

    if (shouldHideFavorites) {
        return null;
    }

    return (
        <div className={classNames('collapsible-content flex-col', isCollapsed && 'collapsed')} id="home-favorites">
            <div className="collapse-toggle" onClick={onToggleExpansion}>
                <div className="flex-row">
                    Favorites Across Campus on {selectedDate.toLocaleDateString()}
                </div>
                <ExpandIcon isExpanded={!isCollapsed}/>
            </div>
            <div className="collapse-body">
                {bodyView}
            </div>
        </div>
    );
};