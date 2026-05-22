import React, { useContext } from 'react';
import { ApplicationContext } from '../../../context/app.ts';
import { getViewName } from '../../../util/cafe.ts';
import { OrderCompletedItem } from './order-completed-item.tsx';

export interface IOrderStatusItem {
    cafeId: string;
    buyOnDemandOrderNumber: string | null;
    waitTimeMin: number | null;
    waitTimeMax: number | null;
    completedAt?: string | null;
}

interface IOrderStatusProps {
    items: IOrderStatusItem[];
}

export const OrderStatus: React.FC<IOrderStatusProps> = ({ items }) => {
    const { viewsById } = useContext(ApplicationContext);

    if (items.length === 0) {
        return (
            <div className="card error">
                Something went wrong! Your completed order details are missing.
            </div>
        );
    }

    return (
        <>
            <div className="card dark-blue">
                <div className="title">Order Complete</div>
                <div>
                    Thanks for your order. Review each cafe receipt below.
                </div>
            </div>
            {items.map((item) => {
                const view = viewsById.get(item.cafeId);
                const cafeName = view
                    ? getViewName({ view, showGroupName: true })
                    : item.cafeId;

                return (
                    <OrderCompletedItem
                        key={item.cafeId}
                        cafeName={cafeName}
                        buyOnDemandOrderNumber={item.buyOnDemandOrderNumber}
                        waitTimeMin={item.waitTimeMin}
                        waitTimeMax={item.waitTimeMax}
                        completedAt={item.completedAt}
                    />
                );
            })}
        </>
    );
};