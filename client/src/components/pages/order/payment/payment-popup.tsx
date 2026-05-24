import React from 'react';
import { Modal } from '../../../popup/modal.tsx';
import { type IPaymentSuccessResult } from '../../../../util/payment-iframe.js';
import { PaymentFormBody } from './payment-form-body.js';

import './payment-iframe.css';

export interface IPaymentPopupProps {
    iframeUrl: string;
    onPaymentComplete: (result: IPaymentSuccessResult) => void;
    onClose: () => void;
}

export const PaymentPopup: React.FC<IPaymentPopupProps> = ({ iframeUrl, onPaymentComplete, onClose }) => {
    return (
        <Modal
            title="Enter Payment Details"
            body={
                <PaymentFormBody
                    iframeUrl={iframeUrl}
                    onPaymentCancelled={onClose}
                    onPaymentSuccess={onPaymentComplete}
                />
            }
        />
    );
};
