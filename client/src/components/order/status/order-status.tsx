import { IPromiseState, PromiseStage } from '@arcticzeroo/react-promise-hook';
import { IOrderCompletionResponse } from '@msdining/common/dist/models/cart';
import React from 'react';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';
import { OrderCompletedList } from './order-completed-list.tsx';

export const OrderStatus: React.FC<IPromiseState<IOrderCompletionResponse>> = ({ stage, value, error }) => {
    if (stage === PromiseStage.running) {
        return (
            <div className="card dark-blue">
                <HourglassLoadingSpinner/>
                <span>
                    Submitting order...
                </span>
            </div>
        );
    }

    if (stage === PromiseStage.error) {
        return (
            <div className="card error">
                Something went wrong when submitting your order: {String(error) || ''}
                <br/>
                The server didn't report back how far your order got.
            </div>
        );
    }

    if (stage === PromiseStage.success) {
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