import { useMemo } from 'react';
import type { IOrderStatusItem } from '../../order/status/order-status.tsx';
import { useNavigate } from 'react-router-dom';
import { useRequiredActiveOrder } from '../../../store/zustand/server-cart.ts';
import { OrderStatus } from '../../order/status/order-status.tsx';

export const OrderCompletePage = () => {
    const navigate = useNavigate();
    const activeOrder = useRequiredActiveOrder();

    const completedItems = useMemo<IOrderStatusItem[]>(() => activeOrder.cafeParts
        .filter(part => part.status === 'completed')
        .map(part => ({
            cafeId:                 part.cafeId,
            buyOnDemandOrderNumber: part.buyOnDemandOrderNumber,
            waitTimeMin:            part.waitTimeMin,
            waitTimeMax:            part.waitTimeMax,
        })), [activeOrder]);

    return (
        <div id="order-checkout" className="flex-col">
            <OrderStatus items={completedItems}/>
            <div className="flex flex-justify-center">
                <button className="default-container" onClick={() => navigate('/')}>
                    Return Home
                </button>
            </div>
        </div>
    );
};
