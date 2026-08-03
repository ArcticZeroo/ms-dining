import React from 'react';
import { HourglassLoadingSpinner } from '../../../icon/hourglass-loading-spinner.js';
import { OverlayNotice } from './overlay-notice.js';
import { PaymentToast } from './payment-toast.js';

const PROCESSING_MESSAGE = 'Processing your payment...';
const STALL_MESSAGE = 'Taking longer than expected. You have not been charged - you can refresh and try again.';

interface IPaymentOverlayProps {
    error: string | null;
    isStalled: boolean;
    isProcessing: boolean;
    onDismissError: () => void;
}

/**
 * The status layer for the payment iframe. In precedence order:
 *  - a terminal error covers the frame as a dismissable card (the iframe is done);
 *  - a stall or in-progress state shows a small non-blocking toast that never
 *    covers or disables the frame, so the iframe's own form and any post-submit
 *    verification step stay interactive.
 * Renders nothing when the iframe is idle.
 */
export const PaymentOverlay: React.FC<IPaymentOverlayProps> = ({
    error,
    isStalled,
    isProcessing,
    onDismissError,
}) => {
    if (error) {
        return (
            <div className="iframe-overlay centered-content">
                <OverlayNotice message={error} actionLabel="Dismiss" onAction={onDismissError}/>
            </div>
        );
    }

    if (isStalled) {
        return (
            <PaymentToast
                icon={<span className="material-symbols-outlined">warning</span>}
                message={STALL_MESSAGE}
            />
        );
    }

    if (isProcessing) {
        return <PaymentToast icon={<HourglassLoadingSpinner/>} message={PROCESSING_MESSAGE}/>;
    }

    return null;
};
