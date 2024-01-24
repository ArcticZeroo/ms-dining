import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { ISearchQuery } from '@msdining/common/dist/models/search';
import { getNowWithDaysInFuture, isSameDate, yieldDaysInFutureForThisWeek } from '@msdining/common/dist/util/date-util';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DiningClient } from '../../../../api/dining.ts';
import { ApplicationContext } from '../../../../context/app.ts';
import { SelectedDateContext } from '../../../../context/time.ts';
import { useValueNotifierContext } from '../../../../hooks/events.ts';
import { useHomepageViews } from '../../../../hooks/views.ts';
import { classNames } from '../../../../util/react.ts';
import { isAnyDateToday } from '../../../../util/search.ts';
import { expandAndFlattenView } from '../../../../util/view.ts';
import { ExpandIcon } from '../../../icon/expand.tsx';
import { HomeFavoriteResult } from './home-favorite-result.tsx';

const useFavoriteSearchResults = (queries: ISearchQuery[]) => {
    const selectedDate = useValueNotifierContext(SelectedDateContext);

    const retrieveFavoriteSearchResults = useCallback(async () => {
        if (queries.length === 0) {
            return [];
        }

        return DiningClient.retrieveFavoriteSearchResults(queries);
    }, [queries]);

    const { stage, value, run } = useDelayedPromiseState(
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

    return { stage, results: filteredResults } as const;
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

    const { stage, results } = useFavoriteSearchResults(queries);

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
                    <span className="loading-spinner"/>
                    Loading favorites...
                </div>
            );
        }

        if (stage === PromiseStage.error) {
            return (
                <div className="error-card">
                    Could not load favorites.
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
    }, [stage, results, selectedDate, cafeIdsOnPage]);

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