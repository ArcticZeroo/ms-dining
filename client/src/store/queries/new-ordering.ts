import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IOrderItem } from '@msdining/common/models/order';
import type { IRguestCardInfo } from '@msdining/common/models/cart';
import { OrderClient } from '../../api/new-ordering.ts';
import { CART_QUERY_KEY } from './server-cart.ts';

export const usePreparePaymentMutation = () => useMutation({
    mutationFn: (data: { cafeId: string; items: IOrderItem[]; alias: string; phoneNumber: string }) =>
        OrderClient.preparePayment(data.cafeId, data.items, data.alias, data.phoneNumber),
});

export const useCompleteOrderMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: { pendingOrderId: string; paymentToken: string; cardInfo: IRguestCardInfo }) =>
            OrderClient.completeOrder(data.pendingOrderId, data.paymentToken, data.cardInfo),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
        },
    });
};

export const useCompletedOrdersTodayQuery = () => useQuery({
    queryKey: ['orders', 'today'],
    queryFn:  () => OrderClient.getCompletedOrdersToday(),
});
