import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IOrderItem, ICafeOrder } from '@msdining/common/models/order';
import type { IPaymentCardInfo } from '@msdining/common/models/cart';
import type { OrderHistorySince } from '../../api/ordering.ts';
import { OrderClient } from '../../api/ordering.ts';
import type { ISynthesisFlags } from '../../api/ordering.ts';
import { CART_QUERY_KEY } from './server-cart.ts';

const COMPLETED_ORDERS_TODAY_KEY = ['orders', 'today'] as const;
const ORDER_HISTORY_QUERY_KEY = (since: OrderHistorySince) => ['order', 'history', since] as const;
const ORDER_HISTORY_RANGE_OPTIONS: OrderHistorySince[] = ['7d', '30d', 'all'];
const ORDER_HISTORY_RANGE_ORDER: Record<OrderHistorySince, number> = {
    '7d':  0,
    '30d': 1,
    all:   2,
};
const ORDER_HISTORY_RANGE_DAYS: Record<Exclude<OrderHistorySince, 'all'>, number> = {
    '7d':  7,
    '30d': 30,
};
const ORDER_COUNT_QUERY_KEY = ['order', 'count'] as const;

const filterOrdersBySince = (orders: ICafeOrder[], since: OrderHistorySince) => {
    if (since === 'all') {
        return orders;
    }

    const dayCount = ORDER_HISTORY_RANGE_DAYS[since];
    const minimumCompletedAtMs = Date.now() - dayCount * 24 * 60 * 60 * 1000;
    return orders.filter((orderData) => orderData.completedAt.getTime() >= minimumCompletedAtMs);
};

const getBestCachedOrderHistory = (queryClient: ReturnType<typeof useQueryClient>, since: OrderHistorySince) => {
    const minimumRangeIndex = ORDER_HISTORY_RANGE_ORDER[since];
    for (const rangeOption of ORDER_HISTORY_RANGE_OPTIONS.slice(minimumRangeIndex)) {
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
            queryClient.removeQueries({ queryKey: ['order', 'history'] });
            queryClient.removeQueries({ queryKey: ORDER_COUNT_QUERY_KEY });
        },
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
