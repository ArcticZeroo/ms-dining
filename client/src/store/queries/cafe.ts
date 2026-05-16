import { toDateString } from '@msdining/common/util/date-util';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DiningClient } from '../../api/client/dining.ts';
import { CafeView, ICafe } from '../../models/cafe.ts';
import { ICancellationToken, pause } from '../../util/async.ts';
import { sortCafesInPriorityOrder } from '../../util/sorting.ts';
import { queryClient } from '../query-client.ts';
import { queryKeys } from './keys.ts';

const TIME_BETWEEN_BACKGROUND_MENU_REQUESTS_MS = 1000;
const RECENT_MENUS_PREFETCH_LIMIT = 5;

export const useCafeMenuQuery = (cafeId: string, date: Date) => {
    const dateString = toDateString(date);
    return useQuery({
        queryKey:  queryKeys.cafe.menu(cafeId, dateString),
        queryFn:   () => DiningClient.retrieveCafeMenu(cafeId, date),
        // Menus only change when the server's cron job re-fetches them. There's
        // no point in TanStack re-fetching on stale-time intervals — invalidate
        // explicitly (e.g. via useForceRefreshCafesMutation) when we know fresh
        // data is available. See Tier 2 plan in the team notes for a future
        // freshness-probe endpoint.
        staleTime: Infinity,
    });
};

export const useCafeOverviewQuery = (viewId: string, date: Date) => {
    const dateString = toDateString(date);
    return useQuery({
        queryKey: queryKeys.cafe.overview(viewId, dateString),
        queryFn:  () => DiningClient.retrieveOverview(viewId, dateString),
    });
};

export const useCafeMenuOverviewSummaryQuery = (viewId: string, date: Date) => {
    const dateString = toDateString(date);
    return useQuery({
        queryKey: queryKeys.cafe.overviewSummary(viewId, dateString),
        queryFn:  () => DiningClient.retrieveMenuOverviewSummary(viewId, dateString),
    });
};

/**
 * Walks the top-N cafes in priority order and warms the TanStack cache with
 * each one's "today" menu, with a short pause between requests so we don't hit
 * the server with a burst. Each prefetch populates the same queryKey that
 * useCafeMenuQuery will read, so subsequent renders are served instantly.
 */
export const prefetchRecentMenusInOrder = async (
    cafes: ICafe[],
    viewsById: Map<string, CafeView>,
    cancellationToken?: ICancellationToken
) => {
    const priorityOrder = sortCafesInPriorityOrder(cafes, viewsById);
    const today = DiningClient.getTodayDateForMenu();
    const dateString = toDateString(today);

    for (const cafe of priorityOrder.slice(0, RECENT_MENUS_PREFETCH_LIMIT)) {
        await pause(TIME_BETWEEN_BACKGROUND_MENU_REQUESTS_MS);

        if (cancellationToken?.isCancelled) {
            break;
        }

        await queryClient.prefetchQuery({
            queryKey:  queryKeys.cafe.menu(cafe.id, dateString),
            queryFn:   () => DiningClient.retrieveCafeMenu(cafe.id, today),
            staleTime: Infinity,
        });
    }
};

/**
 * Forces a server-side refresh of every cafe and returns a mutation. Used by
 * the dev `Force Refresh Cafes` button. Invalidates the local cafe queries on
 * success so the next render pulls the just-refreshed data.
 */
export const useForceRefreshCafesMutation = () => {
    const localQueryClient = useQueryClient();
    return useMutation<void, Error, void>({
        mutationFn: () => DiningClient.forceRefreshCafes(),
        onSuccess:  () => {
            void localQueryClient.invalidateQueries({ queryKey: ['cafe'] });
        },
    });
};
