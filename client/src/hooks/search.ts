import { getMinimumDateForMenu } from '@msdining/common/util/date-util';
import { useContext, useMemo } from 'react';
import { ApplicationSettings } from '../constants/settings.ts';
import { ApplicationContext } from '../context/app.ts';
import { CafeView } from '../models/cafe.js';
import { useRecommendedQueriesQuery } from '../store/queries/search.ts';
import { getAllSingleCafesInView, isViewVisibleForNav } from '../util/view.ts';
import { useValueNotifier } from './events.ts';

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

// Thin re-export so existing imports of `useRecommendedQueries` from
// `hooks/search` keep working without churn. New code should import from
// `store/queries/search.ts` directly.
export const useRecommendedQueries = useRecommendedQueriesQuery;

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