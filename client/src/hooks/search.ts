import { getMinimumDateForMenu } from '@msdining/common/dist/util/date-util';
import { useCallback, useContext, useMemo } from 'react';
import { ApplicationSettings } from '../constants/settings.ts';
import { ApplicationContext } from '../context/app.ts';
import { isViewVisible } from '../util/view.ts';
import { useValueNotifier } from './events.ts';
import { DiningClient } from '../api/dining.js';
import { useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';

export const useAllowedSearchViewIds = () => {
    const { viewsById } = useContext(ApplicationContext);
    const allowedViewIds = useValueNotifier(ApplicationSettings.searchAllowedViewIds);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);
    
    return useMemo(
        () => {
            if (allowedViewIds.size === 0) {
                return new Set<string>();
            }

            const minMenuDate = getMinimumDateForMenu();
            
            const visibleIds = new Set<string>();
            for (const viewId of allowedViewIds) {
                const view = viewsById.get(viewId);
                if (isViewVisible(view, shouldUseGroups, minMenuDate)) {
                    visibleIds.add(viewId);
                }
            }

            return allowedViewIds;
        },
        [allowedViewIds, shouldUseGroups, viewsById]
    );
}

export const useRecommendedQueries = (query: string) => {
    const retrieveQueries = useCallback(
        () => DiningClient.retrieveRecommendedQueries(query),
        [query]
    );

    return useImmediatePromiseState(retrieveQueries);
}