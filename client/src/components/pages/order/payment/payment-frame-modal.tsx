import React, { useCallback, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Modal } from '../../../popup/modal.tsx';
import { type IPaymentIframeProps, type IPaymentSuccessResult } from '../../../../util/payment-iframe.js';
import { PaymentFormBody } from './payment-form-body.js';
import { PaymentCompletionBody } from './payment-completion-body.js';

import './payment-iframe.css';

export const PaymentFrameModal: React.FC<IPaymentIframeProps> = ({ iframeUrl, onPaymentComplete, onPaymentError, onClose }) => {
    const lastPaymentResultRef = useRef<IPaymentSuccessResult | null>(null);

    const orderCompletionState = useMutation<void, Error, IPaymentSuccessResult>({
        mutationFn: (result) => onPaymentComplete(result),
    });
    const { mutate: runCompletion } = orderCompletionState;

    const retryCompletion = useCallback(() => {
        const result = lastPaymentResultRef.current;
        if (result) {
            runCompletion(result);
        }
    }, [runCompletion]);

    const onPaymentSuccess = ({ token, cardInfo }: IPaymentSuccessResult) => {
        lastPaymentResultRef.current = { token, cardInfo };
        runCompletion({ token, cardInfo });
    }

    if (orderCompletionState.isIdle) {
        return (
            <Modal
                title="Enter Payment Details"
                body={
                    <PaymentFormBody
                        iframeUrl={iframeUrl}
                        onPaymentCancelled={onClose}
                        onPaymentError={onPaymentError}
                        onPaymentSuccess={onPaymentSuccess}
                    />
                }
            />
        );
    }

    return (
        <Modal
            title="Processing Payment"
            body={
                <PaymentCompletionBody
                    error={orderCompletionState.error}
                    onRetry={retryCompletion}
                />
            }
        />
    );
};
