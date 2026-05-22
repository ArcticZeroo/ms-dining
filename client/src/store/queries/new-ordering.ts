import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { IRguestCardInfo } from '@msdining/common/models/cart';
import { OrderClient } from '../../api/new-ordering.ts';
import { CART_QUERY_KEY } from './server-cart.ts';
import { useServerCartStore } from '../zustand/server-cart.ts';

/**
 * Checkout: create an order from the current cart.
 * On success, sets the active order in the store from the response
 * (no refetch needed) and invalidates the cart query for background sync.
 */
export const useStartCheckoutMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ alias, phoneNumberWithCountryCode }: {
            alias: string;
            phoneNumberWithCountryCode: string;
        }) => OrderClient.startCheckout(alias, phoneNumberWithCountryCode),
        onSuccess: (activeOrder) => {
            useServerCartStore.getState().setFromServerResponse({
                items:       [],
                activeOrder,
            });
            queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
        },
    });
};

/**
 * Set payment identity (alias + phone) for an order.
 */
export const useSetPaymentIdentityMutation = () => {
    return useMutation({
        mutationFn: ({ orderId, alias, phoneNumberWithCountryCode }: {
            orderId: string;
            alias: string;
            phoneNumberWithCountryCode: string;
        }) => OrderClient.setPaymentIdentity(orderId, alias, phoneNumberWithCountryCode),
    });
};

/**
 * Prepare payment iframe for a specific cafe in an order.
 */
export const usePreparePaymentMutation = () => {
    return useMutation({
        mutationFn: ({ orderId, cafeId }: { orderId: string; cafeId: string }) =>
            OrderClient.preparePayment(orderId, cafeId),
    });
};

/**
 * Complete payment for a specific cafe using the iframe token.
 * On success, invalidates the cart query to refresh the activeOrder state.
 */
export const useCompleteOrderMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ orderId, cafeId, paymentToken, cardInfo }: {
            orderId: string;
            cafeId: string;
            paymentToken: string;
            cardInfo: IRguestCardInfo;
        }) => OrderClient.completeOrder(orderId, cafeId, paymentToken, cardInfo),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
        },
    });
};

/**
 * Abandon remaining cafe parts — marks unpaid cafes as abandoned and
 * returns their items to the cart.
 * On success, invalidates the cart query to reflect returned items.
 */
export const useAbandonRemainingCafesMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (orderId: string) => OrderClient.abandonRemainingCafes(orderId),
        onSuccess:  () => {
            queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
        },
    });
};
