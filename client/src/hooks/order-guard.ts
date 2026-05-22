import { ACTIVE_ORDER_CAFE_PART_STATUSES } from '@msdining/common/models/cart';
import { useMemo } from 'react';
import { useCartQuery } from '../store/queries/server-cart.ts';
import { useServerCartActiveOrder } from '../store/zustand/server-cart.ts';

export interface IOrderGuardResult {
    expectedPath: string | null;
    isLoading: boolean;
    isFetching: boolean;
    activeOrder: ReturnType<typeof useServerCartActiveOrder>;
    hasActiveCafeParts: boolean;
    hasCompletedCafeParts: boolean;
}

export const useOrderGuard = (): IOrderGuardResult => {
    const activeOrder = useServerCartActiveOrder();
    const cartQuery = useCartQuery();

    return useMemo(() => {
        const isLoading = cartQuery.isPending;
        const hasActiveCafeParts = activeOrder?.cafeParts.some(part =>
            ACTIVE_ORDER_CAFE_PART_STATUSES.includes(part.status),
        ) ?? false;
        const hasCompletedCafeParts = activeOrder?.cafeParts.some(part => part.status === 'completed') ?? false;

        let expectedPath: string | null = null;
        if (!isLoading) {
            if (activeOrder != null && hasActiveCafeParts) {
                expectedPath = `/order/${activeOrder.orderSessionId}/pay`;
            } else if (activeOrder != null && hasCompletedCafeParts) {
                expectedPath = `/order/${activeOrder.orderSessionId}/complete`;
            } else {
                expectedPath = '/order';
            }
        }

        return {
            expectedPath,
            isLoading,
            isFetching: cartQuery.isFetching,
            activeOrder,
            hasActiveCafeParts,
            hasCompletedCafeParts,
        };
    }, [activeOrder, cartQuery.isFetching, cartQuery.isPending]);
};
