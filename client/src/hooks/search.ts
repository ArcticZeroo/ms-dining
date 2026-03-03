import { getMinimumDateForMenu } from '@msdining/common/util/date-util';
import { useCallback, useContext, useMemo } from 'react';
import { ApplicationSettings } from '../constants/settings.ts';
import { ApplicationContext } from '../context/app.ts';
import { getAllSingleCafesInView, isViewVisibleForNav } from '../util/view.ts';
import { useValueNotifier } from './events.ts';
import { DiningClient } from '../api/client/dining.js';
import { useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { CafeView } from '../models/cafe.js';

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
                if (isViewVisibleForNav(view, shouldUseGroups, minMenuDate)) {
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

export const useExpandedViewIds = (allowedViewIds: Set<string>, viewsById: Map<string, CafeView>) => {
    return useMemo(
        (): Set<string> => {
            if (allowedViewIds.size === 0) {
                return new Set();
            }

            const viewIds = new Set(allowedViewIds);
            for (const allowedViewId of allowedViewIds) {
                const view = viewsById.get(allowedViewId);
                if (view == null) {
                    continue;
                }

                for (const cafe of getAllSingleCafesInView(view, viewsById)) {
                    viewIds.add(cafe.id);
                }
            }

            return viewIds;
        },
        [allowedViewIds, viewsById]
    );
}