import { useEffect, useMemo } from 'react';
import type { IOrderStatusItem } from '../../order/status/order-status.tsx';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useOrderGuard } from '../../../hooks/order-guard.ts';
import { useCartQuery } from '../../../store/queries/server-cart.ts';
import { RetryButton } from '../../button/retry-button.tsx';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';
import { OnlineOrderingExperimental } from '../../notice/online-ordering-experimental.tsx';
import { OrderStatus } from '../../order/status/order-status.tsx';

export const OrderCompletePage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const cartQuery = useCartQuery();
    const guard = useOrderGuard();

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

    const completedItems = useMemo<IOrderStatusItem[]>(() => activeOrder?.cafeParts
        .filter(part => part.status === 'completed')
        .map(part => ({
            cafeId:                 part.cafeId,
            buyOnDemandOrderNumber: part.buyOnDemandOrderNumber,
            waitTimeMin:            part.waitTimeMin,
            waitTimeMax:            part.waitTimeMax,
        })) ?? [], [activeOrder]);

    if (isWaitingForOrder) {
        return (
            <div className="flex">
                <HourglassLoadingSpinner/>
                Loading your receipt...
            </div>
        );
    }

    if (!isMatchingOrder && cartQuery.isError) {
        return (
            <div id="order-checkout" className="flex-col">
                <OnlineOrderingExperimental/>
                <div className="card error">
                    Failed to load your order receipt.
                    <RetryButton onClick={() => void cartQuery.refetch()}/>
                </div>
            </div>
        );
    }

    if (!isMatchingOrder || activeOrder == null) {
        return (
            <div className="flex">
                <HourglassLoadingSpinner/>
                Loading your receipt...
            </div>
        );
    }

    return (
        <div id="order-checkout" className="flex-col">
            <OnlineOrderingExperimental/>
            <OrderStatus items={completedItems}/>
            <div className="flex flex-justify-center">
                <button className="default-container" onClick={() => navigate('/')}>
                    Return Home
                </button>
            </div>
        </div>
    );
};
