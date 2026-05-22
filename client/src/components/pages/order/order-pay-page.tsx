import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAbandonRemainingCafesMutation } from '../../../store/queries/new-ordering.ts';
import { CART_QUERY_KEY } from '../../../store/queries/server-cart.ts';
import { useServerCartActiveOrder } from '../../../store/zustand/server-cart.ts';
import { OnlineOrderingExperimental } from '../../notice/online-ordering-experimental.tsx';
import { MultiCafePayment } from '../../order/payment/multi-cafe-payment.tsx';
import { WaitTime } from '../../order/wait-time.tsx';

export const OrderPayPage = () => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const activeOrder = useServerCartActiveOrder();
    const abandonMutation = useAbandonRemainingCafesMutation();

    const cancelOrder = useCallback(async () => {
        if (activeOrder == null || abandonMutation.isPending) {
            return;
        }

        await abandonMutation.mutateAsync(activeOrder.orderSessionId);
        await queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
        navigate('/order');
    }, [abandonMutation, activeOrder, navigate, queryClient]);

    const handleCafeCompleted = useCallback(() => undefined, []);

    // Layout guard guarantees activeOrder exists when this page renders
    if (activeOrder == null) {
        return null;
    }

    return (
        <div id="order-checkout" className="flex-col">
            <OnlineOrderingExperimental/>
            <div className="card dark-blue">
                <div className="title">Order Summary</div>
                <WaitTime activeOrder={activeOrder}/>
            </div>
            <MultiCafePayment
                orderId={activeOrder.orderSessionId}
                cafes={activeOrder.cafeParts}
                isCancelling={abandonMutation.isPending}
                onCompleted={handleCafeCompleted}
                onCancelOrder={() => void cancelOrder()}
            />
            {abandonMutation.isError && (
                <div className="card error">
                    {abandonMutation.error instanceof Error ? abandonMutation.error.message : 'Failed to cancel order'}
                </div>
            )}
        </div>
    );
};
