import { toDateString } from '@msdining/common/util/date-util';
import { useMutation, useQuery } from '@tanstack/react-query';
import { DiningClient } from '../../api/client/dining.ts';
import { queryKeys } from './keys.ts';

export const useCafeMenuQuery = (cafeId: string, date: Date, shouldCountTowardsLastUsed: boolean) => {
    const dateString = toDateString(date);
    return useQuery({
        queryKey: queryKeys.cafe.menu(cafeId, dateString, shouldCountTowardsLastUsed),
        queryFn:  () => DiningClient.retrieveCafeMenu({ id: cafeId, date, shouldCountTowardsLastUsed }),
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
 * Forces a server-side refresh of every cafe and returns a mutation. Used by
 * the dev `Force Refresh Cafes` button.
 */
export const useForceRefreshCafesMutation = () =>
    useMutation<void, Error, void>({
        mutationFn: () => DiningClient.forceRefreshCafes(),
    });
