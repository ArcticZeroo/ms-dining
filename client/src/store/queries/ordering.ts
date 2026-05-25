import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IOrderItem } from '@msdining/common/models/order';
import type { IPaymentCardInfo } from '@msdining/common/models/cart';
import { OrderClient } from '../../api/ordering.ts';
import { CART_QUERY_KEY } from './server-cart.ts';

const COMPLETED_ORDERS_TODAY_KEY = ['orders', 'today'] as const;

export const usePreparePaymentMutation = () => useMutation({
    mutationFn: (data: { cafeId: string; items: IOrderItem[] }) =>
        OrderClient.preparePayment(data.cafeId, data.items),
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
        },
    });
};

export const useCompletedOrdersTodayQuery = () => useQuery({
    queryKey: COMPLETED_ORDERS_TODAY_KEY,
    queryFn:  () => OrderClient.getCompletedOrdersToday(),
});
