import { ACTIVE_ORDER_CAFE_PART_STATUSES } from '@msdining/common/models/cart';
import type { IActiveOrderSummary } from '@msdining/common/models/cart';
import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCartQuery } from '../store/queries/server-cart.ts';
import { useServerCartActiveOrder } from '../store/zustand/server-cart.ts';

interface IOrderGuardResult {
    /** null while loading, otherwise the path the user should be at. */
    expectedPath: string | null;
    isLoading: boolean;
    activeOrder: IActiveOrderSummary | undefined;
}

const useOrderGuard = (): IOrderGuardResult => {
    const activeOrder = useServerCartActiveOrder();
    const cartQuery = useCartQuery();

    return useMemo(() => {
        if (cartQuery.isPending) {
            return { expectedPath: null, isLoading: true, activeOrder };
        }

        const hasActiveCafeParts = activeOrder?.cafeParts.some(part =>
            ACTIVE_ORDER_CAFE_PART_STATUSES.includes(part.status),
        ) ?? false;
        const hasCompletedCafeParts = activeOrder?.cafeParts.some(part =>
            part.status === 'completed',
        ) ?? false;

        let expectedPath: string;
        if (activeOrder != null && hasActiveCafeParts) {
            expectedPath = `/order/${activeOrder.orderSessionId}/pay`;
        } else if (activeOrder != null && hasCompletedCafeParts) {
            expectedPath = `/order/${activeOrder.orderSessionId}/complete`;
        } else {
            expectedPath = '/order';
        }

        return { expectedPath, isLoading: false, activeOrder };
    }, [activeOrder, cartQuery.isPending]);
};

/**
 * Reads server state, computes where the user should be, and
 * redirects if the current path doesn't match.
 *
 * Returns `shouldRedirect: true` when a redirect is pending —
 * pages should render a loading state (not their real content)
 * to avoid a flash of the wrong UI before the effect fires.
 */
export const useOrderPageGuard = () => {
    const guard = useOrderGuard();
    const navigate = useNavigate();
    const location = useLocation();

    const shouldRedirect = guard.expectedPath != null && guard.expectedPath !== location.pathname;

    useEffect(() => {
        if (shouldRedirect && guard.expectedPath != null) {
            navigate(guard.expectedPath, { replace: true });
        }
    }, [shouldRedirect, guard.expectedPath, navigate]);

    return {
        ...guard,
        shouldRedirect,
    };
};
