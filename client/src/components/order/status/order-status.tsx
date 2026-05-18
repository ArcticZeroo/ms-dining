import { IOrderCompletionResponse } from '@msdining/common/models/cart';
import React from 'react';
import { OrderCompletedList } from './order-completed-list.tsx';

interface IOrderStatusProps {
    value: IOrderCompletionResponse | undefined;
}

export const OrderStatus: React.FC<IOrderStatusProps> = ({ value }) => {
    if (value == null) {
        return (
            <div className="card error">
                Something went wrong! The response is missing!
            </div>
        );
    }

    return (
        <OrderCompletedList response={value}/>
    );
}