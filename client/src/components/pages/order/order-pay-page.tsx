import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAbandonRemainingCafesMutation } from '../../../store/queries/new-ordering.ts';
import { CART_QUERY_KEY } from '../../../store/queries/server-cart.ts';
import { useRequiredActiveOrder } from '../../../store/zustand/server-cart.ts';
import { getErrorMessage } from '../../../util/mutation.ts';
import { OnlineOrderingExperimental } from '../../notice/online-ordering-experimental.tsx';
import { MultiCafePayment } from '../../order/payment/multi-cafe-payment.tsx';
import { WaitTime } from '../../order/wait-time.tsx';

export const OrderPayPage = () => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const activeOrder = useRequiredActiveOrder();
    const abandonMutation = useAbandonRemainingCafesMutation();

    const cancelOrder = useCallback(async () => {
        if (abandonMutation.isPending) {
            return;
        }

        await abandonMutation.mutateAsync(activeOrder.orderSessionId);
        await queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
        navigate('/order');
    }, [abandonMutation, activeOrder, navigate, queryClient]);

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
                onCancelOrder={() => cancelOrder()}
            />
            {abandonMutation.isError && (
                <div className="card error">
                    {getErrorMessage(abandonMutation.error, 'Failed to cancel order')}
                </div>
            )}
        </div>
    );
};
