import React from 'react';
import { IPromiseState, PromiseStage } from '@arcticzeroo/react-promise-hook';
import { IOrderCompletionResponse } from '@msdining/common/dist/models/cart';
import { OrderCompletedList } from './order-completed-list.tsx';


export const OrderStatus: React.FC<IPromiseState<IOrderCompletionResponse>> = ({ stage, value, error }) => {
    if (stage === PromiseStage.running) {
        return (
            <div className="card dark-blue">
                <span className="loading-spinner"/>
                <span>
                    Submitting order...
                </span>
            </div>
        );
    } else if (stage === PromiseStage.error) {
        return (
            <div className="card error">
                Something went wrong! {error || ''}
                <br/>
                Your order might have been submitted.
            </div>
        );
    } else if (stage === PromiseStage.success) {
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
}