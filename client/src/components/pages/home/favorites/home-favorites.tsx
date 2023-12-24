import { useValueNotifier, useValueNotifierContext } from '../../../../hooks/events.ts';
import { ApplicationSettings } from '../../../../api/settings.ts';
import { useCallback, useMemo } from 'react';
import { DiningClient } from '../../../../api/dining.ts';
import { ISearchQuery, SearchEntityType } from '@msdining/common/dist/models/search';
import { PromiseStage, useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { isAnyDateToday } from '../../../../util/search.ts';
import { HomeFavoriteResultList } from './home-favorite-result-list.tsx';
import { SelectedDateContext } from '../../../../context/time.ts';

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

    const { stage, value } = useImmediatePromiseState(retrieveFavoriteSearchResults);

    const filteredResults = useMemo(
        () => {
            const results = value ?? [];
            return results.filter(item => isAnyDateToday(item.locationDatesByCafeId, selectedDate));
        },
        [value, selectedDate]
    );

    return { stage, results: filteredResults } as const;
}

export const HomeFavorites = () => {
    const favoriteItemNames = useValueNotifier(ApplicationSettings.favoriteItemNames);

    const { stage, results } = useFavoriteSearchResults(favoriteItemNames);

    if (favoriteItemNames.size === 0) {
        return null;
    }

    if (stage === PromiseStage.running) {
        return (
            <div className="card">
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

    return (
        <HomeFavoriteResultList results={results}/>
    );
};