import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { ISearchQuery, SearchEntityType } from '@msdining/common/dist/models/search.js';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DiningClient } from '../../../../api/dining.ts';
import { SelectedDateContext } from '../../../../context/time.ts';
import { useValueNotifierContext } from '../../../../hooks/events.ts';
import { classNames } from '../../../../util/react.ts';
import { isAnyDateToday } from '../../../../util/search.ts';
import { ExpandIcon } from '../../../icon/expand.tsx';
import { HomeFavoriteResult } from './home-favorite-result.tsx';

const useFavoriteSearchResults = (favoriteItemNames: Set<string>) => {
    const selectedDate = useValueNotifierContext(SelectedDateContext);

    const retrieveFavoriteSearchResults = useCallback(async () => {
        if (favoriteItemNames.size === 0) {
            return [];
        }

        const queries: ISearchQuery[] = Array.from(favoriteItemNames).map(name => ({
            text: name,
            type: SearchEntityType.menuItem
        }));

        return DiningClient.retrieveFavoriteSearchResults(queries);
    }, [favoriteItemNames]);

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
}

interface IHomeFavoritesViewProps {
    names: Set<string>;
}

export const HomeFavoritesView: React.FC<IHomeFavoritesViewProps> = ({ names }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const selectedDate = useValueNotifierContext(SelectedDateContext);

    const onToggleExpansion = () => {
        setIsCollapsed(!isCollapsed);
    }

    const { stage, results } = useFavoriteSearchResults(names);

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
            return;
        }

        return results.map(result => (
            <HomeFavoriteResult
                key={result.name}
                result={result}
                date={selectedDate}
            />
        ));
    }, [stage, results, selectedDate]);

    return (
        <div className="collapsible-content flex-col" id="home-favorites">
            <div className="collapse-toggle" onClick={onToggleExpansion}>
                <div className="flex-row">
                    Favorites Across Campus on {selectedDate.toLocaleDateString()}
                </div>
                <ExpandIcon isExpanded={!isCollapsed}/>
            </div>
            <div
                className={classNames('collapse-body', isCollapsed && 'collapsed')}
                id="home-favorites-results"
            >
                {bodyView}
            </div>
        </div>
    );
};