import { useMutation, useQueryClient } from '@tanstack/react-query';
import { OrderClient } from '../../api/new-ordering.ts';
import type { IRguestCardInfo } from '@msdining/common/models/cart';

const CART_QUERY_KEY = ['cart', 'server'] as const;

/**
 * Checkout: create an order from the current cart.
 * On success, invalidates the cart query so the cart UI reflects
 * the cleared cart + active order.
 */
export const useStartCheckoutMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => OrderClient.startCheckout(),
        onSuccess:  () => {
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
 * Abandon an order — marks unfinished cafe parts as abandoned.
 * On success, invalidates the cart query to unlock the cart.
 */
export const useAbandonOrderMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (orderId: string) => OrderClient.abandonOrder(orderId),
        onSuccess:  () => {
            queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
        },
    });
};
