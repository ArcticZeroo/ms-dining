import { IOrderCompletionResponse } from '@msdining/common/models/cart';
import React, { useContext } from 'react';
import { ApplicationContext } from '../../../context/app.ts';
import { OrderCompletedItem } from './order-completed-item.tsx';

interface IOrderCompletedStatusProps {
    response: IOrderCompletionResponse;
}

export const OrderCompletedList: React.FC<IOrderCompletedStatusProps> = ({ response }) => {
    const { viewsById } = useContext(ApplicationContext);

    return (
        Object.entries(response)
            .map(([cafeId, result]) => {
                const cafeView = viewsById.get(cafeId);

                if (cafeView == null) {
                    console.error('How did we get a response for a cafe that does not exist?', cafeId);
                    return null;
                }

                return (
                    <OrderCompletedItem key={cafeId} view={cafeView} result={result}/>
                );
            })
    );
}