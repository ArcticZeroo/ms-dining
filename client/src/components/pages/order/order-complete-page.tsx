import { useMemo } from 'react';
import type { IOrderStatusItem } from '../../order/status/order-status.tsx';
import { useNavigate } from 'react-router-dom';
import { useServerCartActiveOrder } from '../../../store/zustand/server-cart.ts';
import { OnlineOrderingExperimental } from '../../notice/online-ordering-experimental.tsx';
import { OrderStatus } from '../../order/status/order-status.tsx';

export const OrderCompletePage = () => {
    const navigate = useNavigate();
    const activeOrder = useServerCartActiveOrder();

    const completedItems = useMemo<IOrderStatusItem[]>(() => activeOrder?.cafeParts
        .filter(part => part.status === 'completed')
        .map(part => ({
            cafeId:                 part.cafeId,
            buyOnDemandOrderNumber: part.buyOnDemandOrderNumber,
            waitTimeMin:            part.waitTimeMin,
            waitTimeMax:            part.waitTimeMax,
        })) ?? [], [activeOrder]);

    // Layout guard guarantees activeOrder exists when this page renders
    if (activeOrder == null) {
        return null;
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
