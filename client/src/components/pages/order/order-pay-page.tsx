import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useOrderGuard } from '../../../hooks/order-guard.ts';
import { useAbandonRemainingCafesMutation } from '../../../store/queries/new-ordering.ts';
import { CART_QUERY_KEY, useCartQuery } from '../../../store/queries/server-cart.ts';
import { RetryButton } from '../../button/retry-button.tsx';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';
import { OnlineOrderingExperimental } from '../../notice/online-ordering-experimental.tsx';
import { MultiCafePayment } from '../../order/payment/multi-cafe-payment.tsx';
import { WaitTime } from '../../order/wait-time.tsx';

const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message;
    }

    return fallback;
};

export const OrderPayPage = () => {
    const { id } = useParams();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const location = useLocation();
    const cartQuery = useCartQuery();
    const guard = useOrderGuard();
    const abandonMutation = useAbandonRemainingCafesMutation();
    const [checkoutError, setCheckoutError] = useState<string>();

    const activeOrder = guard.activeOrder;
    const isMatchingOrder = id != null && activeOrder?.orderSessionId === id;
    const isWaitingForOrder = id != null
        && !isMatchingOrder
        && !cartQuery.isError
        && (guard.isLoading || guard.isFetching);

    useEffect(() => {
        if (!isWaitingForOrder && guard.expectedPath != null && guard.expectedPath !== location.pathname) {
            navigate(guard.expectedPath, { replace: true });
        }
    }, [guard.expectedPath, isWaitingForOrder, location.pathname, navigate]);

    const handleCafeCompleted = useCallback(() => undefined, []);

    const cancelOrder = useCallback(async () => {
        if (id == null || abandonMutation.isPending) {
            return;
        }

        setCheckoutError(undefined);

        try {
            await abandonMutation.mutateAsync(id);
            await queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
            navigate('/order');
        } catch (error) {
            setCheckoutError(getErrorMessage(error, 'Failed to cancel order'));
        }
    }, [abandonMutation, id, navigate, queryClient]);

    if (isWaitingForOrder || (isMatchingOrder && guard.hasActiveCafeParts && activeOrder == null)) {
        return (
            <div className="flex">
                <HourglassLoadingSpinner/>
                Loading your order...
            </div>
        );
    }

    if (!isMatchingOrder && cartQuery.isError) {
        return (
            <div id="order-checkout" className="flex-col">
                <OnlineOrderingExperimental/>
                <div className="card error">
                    {getErrorMessage(cartQuery.error, 'Failed to load your order.')}
                    <RetryButton onClick={() => void cartQuery.refetch()}/>
                </div>
            </div>
        );
    }

    if (!isMatchingOrder || activeOrder == null) {
        return (
            <div className="flex">
                <HourglassLoadingSpinner/>
                Loading your order...
            </div>
        );
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
            {checkoutError && (
                <div className="card error">
                    {checkoutError}
                </div>
            )}
        </div>
    );
};
