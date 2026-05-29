import { useMemo } from 'react';
import { useCartQuery } from '../store/queries/server-cart.ts';
import { useServerCartHasUnavailableItems, useServerCartItemCount } from '../store/zustand/server-cart.ts';

export interface CartStatusInput {
    isPending: boolean;
    isError: boolean;
    error: Error | null;
    hasData: boolean;
    totalItemCount: number;
    hasUnavailableItems: boolean;
}

export interface ICartStatus {
    /** True while the initial cart fetch is in progress (no data yet). */
    isLoading: boolean;
    /** True if the cart fetch failed and we have no existing data to show. */
    isError: boolean;
    /** The error from the cart query, if any. */
    error: Error | null;
    /** Number of items in the cart (from Zustand store, survives failed refetches). */
    totalItemCount: number;
    /** True if some cart items are no longer available on today's menu. */
    hasUnavailableItems: boolean;
    /** True if there's a problem the user should be aware of (error or unavailable items). */
    hasWarning: boolean;
    /** True if we should show the cart UI at all. */
    shouldShow: boolean;
    /** Retry the cart fetch. */
    refetch: () => void;
}

export const computeCartStatus = (input: CartStatusInput): Omit<ICartStatus, 'refetch'> => {
    const isError = input.isError && !input.hasData;

    return {
        isLoading:          input.isPending,
        isError,
        error:              input.error,
        totalItemCount:     input.totalItemCount,
        hasUnavailableItems: input.hasUnavailableItems,
        hasWarning:         input.hasUnavailableItems || isError,
        shouldShow:         input.totalItemCount > 0 || input.hasUnavailableItems || input.isPending || isError,
    };
};

/**
 * Rolls up cart query state + Zustand store state into a single
 * memoized status object. Handles the "stale data" case: if a
 * background refetch fails but we already have cart data, the error
 * is suppressed.
 */
export const useCartStatus = (): ICartStatus=> {
    const cartQuery = useCartQuery();
    const totalItemCount = useServerCartItemCount();
    const hasUnavailableItems = useServerCartHasUnavailableItems();
    const hasData = cartQuery.data != null || totalItemCount > 0;

    const status = useMemo(
        () => computeCartStatus({
            isPending:   cartQuery.isPending,
            isError:     cartQuery.isError,
            error:       cartQuery.error,
            hasData,
            totalItemCount,
            hasUnavailableItems,
        }),
        [cartQuery.isPending, cartQuery.isError, cartQuery.error, hasData, totalItemCount, hasUnavailableItems],
    );

    return useMemo(
        () => ({ ...status, refetch: cartQuery.refetch }),
        [status, cartQuery.refetch],
    );
};
