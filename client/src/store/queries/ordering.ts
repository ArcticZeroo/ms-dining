import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IOrderItem, ICafeOrder } from '@msdining/common/models/order';
import type { IPaymentCardInfo } from '@msdining/common/models/cart';
import type { OrderHistorySince } from '../../api/ordering.ts';
import { OrderClient } from '../../api/ordering.ts';
import type { ISynthesisFlags } from '../../api/ordering.ts';
import { useIsLoggedIn } from '../../hooks/auth.ts';
import { CART_QUERY_KEY } from './server-cart.ts';
import { queryKeys } from './keys.ts';

const COMPLETED_ORDERS_TODAY_KEY = ['orders', 'today'] as const;
const RECENT_ORDERS_QUERY_KEY = ['order', 'recent'] as const;
const ORDER_HISTORY_QUERY_KEY = (since: OrderHistorySince) => ['order', 'history', since] as const;
const ORDER_HISTORY_RANGE_ORDER: Record<OrderHistorySince, number> = {
    today: 0,
    '7d':  1,
    '30d': 2,
    all:   3,
};
const ORDER_COUNT_QUERY_KEY = ['order', 'count'] as const;

const filterOrdersBySince = (orders: ICafeOrder[], since: OrderHistorySince) => {
    if (since === 'all') {
        return orders;
    }

    if (since === 'today') {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        return orders.filter((orderData) => orderData.completedAt >= startOfDay);
    }

    const dayCount = since === '7d' ? 7 : 30;
    const minimumCompletedAtMs = Date.now() - dayCount * 24 * 60 * 60 * 1000;
    return orders.filter((orderData) => orderData.completedAt.getTime() >= minimumCompletedAtMs);
};

const ORDER_HISTORY_RANGES_BY_SIZE = (Object.keys(ORDER_HISTORY_RANGE_ORDER) as OrderHistorySince[])
    .sort((rangeA, rangeB) => ORDER_HISTORY_RANGE_ORDER[rangeA] - ORDER_HISTORY_RANGE_ORDER[rangeB]);

const getBestCachedOrderHistory = (queryClient: ReturnType<typeof useQueryClient>, since: OrderHistorySince) => {
    const minimumRangeIndex = ORDER_HISTORY_RANGE_ORDER[since];
    for (const rangeOption of ORDER_HISTORY_RANGES_BY_SIZE.slice(minimumRangeIndex)) {
        const cachedOrders = queryClient.getQueryData<ICafeOrder[]>(ORDER_HISTORY_QUERY_KEY(rangeOption));
        if (cachedOrders != null) {
            return {
                orders: cachedOrders,
                since:  rangeOption,
            };
        }
    }

    return null;
};

export const usePreparePaymentMutation = () => useMutation({
    mutationFn: (data: { cafeId: string; items: IOrderItem[]; synthesisFlags?: ISynthesisFlags }) =>
        OrderClient.preparePayment(data.cafeId, data.items, data.synthesisFlags),
});

export const useCompleteOrderMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: {
            pendingOrderId: string;
            paymentToken: string;
            cardInfo: IPaymentCardInfo;
            alias: string;
            phoneNumber: string;
        }) => OrderClient.completeOrder(data.pendingOrderId, data.paymentToken, data.cardInfo, data.alias, data.phoneNumber),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
            queryClient.invalidateQueries({ queryKey: COMPLETED_ORDERS_TODAY_KEY });
            queryClient.invalidateQueries({ queryKey: RECENT_ORDERS_QUERY_KEY });
            queryClient.removeQueries({ queryKey: ['order', 'history'] });
            queryClient.removeQueries({ queryKey: ORDER_COUNT_QUERY_KEY });
        },
    });
};

export const useRecentOrdersQuery = () => {
    const isLoggedIn = useIsLoggedIn();

    return useQuery({
        queryKey:  RECENT_ORDERS_QUERY_KEY,
        queryFn:   () => OrderClient.getRecentOrders(),
        staleTime: Infinity,
        enabled:   isLoggedIn,
    });
};

export const useCompletedOrdersTodayQuery = () => useQuery({
    queryKey: COMPLETED_ORDERS_TODAY_KEY,
    queryFn:  () => OrderClient.getCompletedOrdersToday(),
});

export const useOrderHistoryQuery = (since: OrderHistorySince) => {
    const queryClient = useQueryClient();
    const cachedResult = getBestCachedOrderHistory(queryClient, since);
    const hasCachedSuperset = cachedResult != null && cachedResult.since !== since;

    // If a larger range is already cached, seed this range's cache from it
    // so we don't refetch. Otherwise fetch normally.
    // keepPreviousData keeps the old list visible while fetching a new range.
    return useQuery({
        queryKey:        ORDER_HISTORY_QUERY_KEY(since),
        queryFn:         () => OrderClient.getOrderHistory(since),
        enabled:         !hasCachedSuperset,
        initialData:     hasCachedSuperset
            ? () => filterOrdersBySince(cachedResult.orders, since)
            : undefined,
        placeholderData: keepPreviousData,
    });
};

export const useOrderCountQuery = () => useQuery({
    queryKey: ORDER_COUNT_QUERY_KEY,
    queryFn:  () => OrderClient.getOrderCount(),
});

const WAIT_TIME_REFETCH_INTERVAL_MS = 2 * 60 * 1000;
const WAIT_TIME_STALE_TIME_MS = 60 * 1000;

export const useWaitTimeQuery = (cafeId: string) => {
    const isLoggedIn = useIsLoggedIn();

    return useQuery({
        queryKey:        queryKeys.ordering.waitTime(cafeId),
        queryFn:         () => OrderClient.getWaitTime(cafeId),
        enabled:         isLoggedIn,
        refetchInterval: WAIT_TIME_REFETCH_INTERVAL_MS,
        staleTime:       WAIT_TIME_STALE_TIME_MS,
        placeholderData: keepPreviousData,
    });
};

/**
 * Fetches wait times for all cafes in the cart in parallel and aggregates
 * to the worst-case (max) range — the longest cafe determines actual wait.
 */
export const useAggregatedWaitTime = (cafeIds: string[]) => {
    const isLoggedIn = useIsLoggedIn();

    const results = useQueries({
        queries: cafeIds.map(cafeId => ({
            queryKey:        queryKeys.ordering.waitTime(cafeId),
            queryFn:         () => OrderClient.getWaitTime(cafeId),
            enabled:         isLoggedIn,
            refetchInterval: WAIT_TIME_REFETCH_INTERVAL_MS,
            staleTime:       WAIT_TIME_STALE_TIME_MS,
            placeholderData: keepPreviousData,
        })),
    });

    const loaded = results.filter(result => result.data != null).map(result => result.data!);

    if (loaded.length === 0) {
        return undefined;
    }

    return {
        minTime: Math.min(...loaded.map(entry => entry.minTime)),
        maxTime: Math.max(...loaded.map(entry => entry.maxTime)),
    };
};
