import React from 'react';

interface IPaymentToastProps {
    icon: React.ReactNode;
    message: string;
}

/**
 * A small, non-blocking status pill shown over the payment iframe. It sits at the
 * bottom of the frame and lets pointer events pass through, so the iframe's own
 * form — including any post-submit verification step — stays fully interactive.
 */
export const PaymentToast: React.FC<IPaymentToastProps> = ({ icon, message }) => (
    <div className="iframe-toast card">
        {icon}
        <span>{message}</span>
    </div>
);
