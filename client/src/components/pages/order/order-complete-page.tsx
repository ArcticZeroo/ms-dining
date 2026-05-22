import { useMemo } from 'react';
import type { IOrderStatusItem } from '../../order/status/order-status.tsx';
import { useNavigate } from 'react-router-dom';
import { useOrderPageGuard } from '../../../hooks/order-guard.ts';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';
import { OnlineOrderingExperimental } from '../../notice/online-ordering-experimental.tsx';
import { OrderStatus } from '../../order/status/order-status.tsx';

export const OrderCompletePage = () => {
    const navigate = useNavigate();
    const { isLoading, activeOrder } = useOrderPageGuard();

    const completedItems = useMemo<IOrderStatusItem[]>(() => activeOrder?.cafeParts
        .filter(part => part.status === 'completed')
        .map(part => ({
            cafeId:                 part.cafeId,
            buyOnDemandOrderNumber: part.buyOnDemandOrderNumber,
            waitTimeMin:            part.waitTimeMin,
            waitTimeMax:            part.waitTimeMax,
        })) ?? [], [activeOrder]);

    if (isLoading || activeOrder == null) {
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
