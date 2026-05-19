import { ICompleteOrderRequest, IOrderCompletionData, IPrepareCartResponse, IPreparePaymentResponse } from '@msdining/common/models/cart';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { OrderingClient } from '../../api/order.ts';
import { CartItemsByCafeId } from '../../models/cart.ts';
import { IPaymentFormData, useOrderingStore } from '../zustand/ordering.ts';
import { useCartStore } from '../zustand/cart.ts';
import { queryClient } from '../query-client.ts';
import { queryKeys } from './keys.ts';

// Server-side carts have no keepalive loop and expire after roughly five
// minutes. Stay a touch under that so a freshly-cached session is never on the
// edge of expiry when the user hits "Pay".
const CART_SESSION_STALE_MS = 4 * 60 * 1000;

// On "Pay" click, we normally refetch /prepare/cart to maximize the time the
// user has to complete payment within the server's ~5-minute cart-session
// expiry. If the cached data is fresher than this threshold the user still
// has well over four minutes left, so we skip the refetch — eliminates a
// redundant round-trip and the dual "Building your order…" / "Preparing
// payment…" spinners on the common case of clicking Pay right after the
// page loads.
export const PAY_CLICK_CACHE_FRESHNESS_MS = 60 * 1000;

/**
 * Stable hash over the cart contents that affect server-side preparation.
 * Two identical carts hash to the same value so TanStack Query can dedupe.
 *
 * Exported for testing.
 */
export const cartHashForKey = (cart: CartItemsByCafeId): string => {
    const cafeParts: string[] = [];

    for (const [cafeId, items] of cart) {
        const itemParts: string[] = [];

        for (const item of items.values()) {
            const modifierParts: string[] = [];
            for (const [modifierId, choiceIds] of item.choicesByModifierId.entries()) {
                const sortedChoiceIds = [...choiceIds].sort();
                modifierParts.push(`${modifierId}:${sortedChoiceIds.join(',')}`);
            }
            modifierParts.sort();

            itemParts.push(
                `${item.itemId}x${item.quantity}{${modifierParts.join('|')}}[${item.specialInstructions ?? ''}]`
            );
        }

        itemParts.sort();
        cafeParts.push(`${cafeId}=${itemParts.join(';')}`);
    }

    cafeParts.sort();
    return cafeParts.join('||');
};

const cartSessionQueryKey = (cart: CartItemsByCafeId) =>
    [...queryKeys.ordering.cartSession, cartHashForKey(cart)] as const;

/**
 * Server-side cart session. Owns the "build the cart, give me prices + wait
 * times + per-cafe orderIds" call. Shared across the cart popup, order page,
 * wait-time view, and inline price table — TanStack dedupes to one network
 * call per unique cart content.
 */
export const useCartSessionQuery = () => {
    const cart = useCartStore((state) => state.items);

    return useQuery({
        queryKey:         cartSessionQueryKey(cart),
        queryFn:          () => OrderingClient.prepareCart(cart),
        enabled:          cart.size > 0,
        staleTime:        CART_SESSION_STALE_MS,
        refetchInterval:  CART_SESSION_STALE_MS,
        refetchOnMount:   true,
    });
};

interface IPrepareAllPaymentsResult {
    formData: IPaymentFormData;
    prepareByCafeId: Record<string, IPreparePaymentResponse>;
}

/**
 * Returns the existing cached cart session if it was fetched within the
 * `freshnessMs` window, otherwise issues a fresh /prepare/cart fetch.
 * Exported so the Pay-click mutation and tests can share the freshness logic.
 */
export const getFreshOrCachedCartSession = async (
    cart: CartItemsByCafeId,
    freshnessMs: number = PAY_CLICK_CACHE_FRESHNESS_MS,
): Promise<IPrepareCartResponse> => {
    const queryKey = cartSessionQueryKey(cart);
    const cached = queryClient.getQueryState<IPrepareCartResponse>(queryKey);
    if (cached?.data != null && cached.status === 'success'
        && Date.now() - cached.dataUpdatedAt < freshnessMs) {
        return cached.data;
    }

    // fetchQuery (not ensureQueryData) guarantees a network round-trip
    // — ensureQueryData would return cached-but-stale data.
    return queryClient.fetchQuery<IPrepareCartResponse>({
        queryKey,
        queryFn:   () => OrderingClient.prepareCart(cart),
        staleTime: 0,
    });
};

/**
 * "Click Pay → preparePayment(orderId) for every cafe in parallel". Re-uses a
 * fresh cart-session (cached < {@link PAY_CLICK_CACHE_FRESHNESS_MS} ago) or
 * issues a fresh fetch — the per-cafe orderIds handed to the iframes are then
 * guaranteed to be inside the server's ~5-minute cart-session expiry window.
 * Results are written into the ordering store.
 */
export const usePrepareAllPaymentsMutation = () => {
    const startCheckout = useOrderingStore((state) => state.startCheckout);

    return useMutation<IPrepareAllPaymentsResult, Error, IPaymentFormData>({
        mutationFn: async (formData) => {
            const cart = useCartStore.getState().items;
            const cartSession = await getFreshOrCachedCartSession(cart);

            const entries = await Promise.all(
                Object.entries(cartSession).map(async ([cafeId, cafeData]) => {
                    const prepare = await OrderingClient.preparePayment(cafeData.orderId);
                    return [cafeId, prepare] as const;
                })
            );

            return { formData, prepareByCafeId: Object.fromEntries(entries) };
        },
        onSuccess: ({ formData, prepareByCafeId }) => {
            startCheckout(formData, prepareByCafeId);
        },
    });
};

/**
 * Re-fetches the iframe URL for an existing cafe orderId. Used when the user
 * closes the iframe popup and clicks "Pay" again — the original siteToken is
 * single-use.
 */
export const useCafeRepreparePaymentMutation = (cafeId: string, orderId: string) => {
    const setIframeUrl = useOrderingStore((state) => state.setIframeUrl);
    const setError = useOrderingStore((state) => state.setError);

    return useMutation<IPreparePaymentResponse, Error, void>({
        mutationFn: () => OrderingClient.preparePayment(orderId),
        onSuccess:  (response) => {
            setIframeUrl(cafeId, response.iframeUrl);
        },
        onError:    (err) => {
            setError(cafeId, err.message);
        },
    });
};

interface ICompleteCafePaymentArgs {
    cafeId: string;
    request: ICompleteOrderRequest;
}

/**
 * Finalizes payment for a single cafe. On success: records the completion in
 * the ordering store, removes the cafe from the cart, and invalidates the
 * cart-session cache so a follow-up checkout starts from a fresh server cart.
 */
export const useCafeCompleteMutation = () => {
    const queryClientInstance = useQueryClient();
    const recordCompletion = useOrderingStore((state) => state.recordCompletion);
    const setError = useOrderingStore((state) => state.setError);
    const removeCafe = useCartStore((state) => state.removeCafe);

    return useMutation<IOrderCompletionData, Error, ICompleteCafePaymentArgs>({
        mutationFn: ({ request }) => OrderingClient.completeOrder(request),
        onSuccess:  (result, { cafeId }) => {
            recordCompletion(cafeId, result);
            removeCafe(cafeId);
            void queryClientInstance.invalidateQueries({ queryKey: queryKeys.ordering.cartSession });
        },
        onError:    (err, { cafeId }) => {
            setError(cafeId, err.message);
        },
    });
};
