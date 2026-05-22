import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAbandonRemainingCafesMutation } from '../../../store/queries/new-ordering.ts';
import { useRequiredActiveOrder } from '../../../store/zustand/server-cart.ts';
import { getErrorMessage } from '../../../util/mutation.ts';
import { OnlineOrderingExperimental } from '../../notice/online-ordering-experimental.tsx';
import { OrderItemsSummary } from '../../order/status/order-items-summary.tsx';
import { MultiCafePayment } from '../../order/payment/multi-cafe-payment.tsx';
import { WaitTime } from '../../order/wait-time.tsx';

export const OrderPayPage = () => {
    const navigate = useNavigate();
    const activeOrder = useRequiredActiveOrder();
    const abandonMutation = useAbandonRemainingCafesMutation();

    const cancelOrder = useCallback(async () => {
        if (abandonMutation.isPending) {
            return;
        }

        await abandonMutation.mutateAsync(activeOrder.orderSessionId);
        navigate('/order');
    }, [abandonMutation, activeOrder, navigate]);

    return (
        <div id="order-checkout" className="flex-col">
            <OnlineOrderingExperimental/>
            <div className="card dark-blue">
                <div className="title">Order Summary</div>
                <OrderItemsSummary cafeParts={activeOrder.cafeParts}/>
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
