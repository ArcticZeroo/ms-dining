import React from 'react';
import { RetryButton } from '../../../button/retry-button.js';
import { HourglassLoadingSpinner } from '../../../icon/hourglass-loading-spinner.js';
import { getErrorMessage } from '../../../../util/mutation.js';

interface IPaymentCompletionBodyProps {
    error: Error | null;
    onRetry: () => void;
}

export const PaymentCompletionBody: React.FC<IPaymentCompletionBodyProps> = ({ error, onRetry }) => {
    if (error) {
        const errorMessage = getErrorMessage(error, 'Failed to complete order');

        return (
            <div className="payment-error">
                <div>{errorMessage}</div>
                <RetryButton onClick={onRetry}/>
            </div>
        );
    }

    // Success should auto-close the modal so the only other state is pending
    return (
        <div className="payment-completing">
            <HourglassLoadingSpinner/>
            <span>Processing payment...</span>
        </div>
    );
};