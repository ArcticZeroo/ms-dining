import { useValueNotifier } from '../../../../hooks/events.ts';
import { ApplicationSettings } from '../../../../api/settings.ts';
import { useCallback } from 'react';
import { DiningClient } from '../../../../api/dining.ts';
import { ISearchQuery, SearchEntityType } from '@msdining/common/dist/models/search';
import { PromiseStage, useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';

const useFavoriteSearchResults = (favoriteItemNames: Set<string>) => {
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

    return { stage, results: value ?? [] } as const;
}

export const HomeFavorites = () => {
    const favoriteItemNames = useValueNotifier(ApplicationSettings.favoriteItemNames);

    const { stage, results } = useFavoriteSearchResults(favoriteItemNames);

    if (favoriteItemNames.size === 0) {
        return null;
    }

    if (stage === PromiseStage.running) {
        return (
            <div>
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

    return (
        <div>
            Results:
            {
                results.map(result => result.name)
            }
        </div>
    );
};