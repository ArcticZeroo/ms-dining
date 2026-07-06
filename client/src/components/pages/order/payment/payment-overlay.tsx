import React, { useMemo } from 'react';
import { HourglassLoadingSpinner } from '../../../icon/hourglass-loading-spinner.js';
import { OverlayNotice } from './overlay-notice.js';

const PROCESSING_MESSAGE = 'Processing your payment...';
const STALL_MESSAGE = 'This is taking longer than expected. You have not been charged, you can refresh and try again.';

interface IPaymentOverlayProps {
    error: string | null;
    isStalled: boolean;
    isProcessing: boolean;
    onDismissError: () => void;
    onClose: () => void;
}

/**
 * The layer that sits on top of the payment iframe. Shows (in precedence order) a
 * dismissible error, an advisory stall notice, or an in-progress spinner. Renders
 * nothing when the iframe is idle so the form underneath is interactive.
 */
export const PaymentOverlay: React.FC<IPaymentOverlayProps> = ({
    error,
    isStalled,
    isProcessing,
    onDismissError,
    onClose,
}) => {
    const content = useMemo<React.ReactNode>(() => {
        if (error) {
            return <OverlayNotice message={error} actionLabel="Dismiss" onAction={onDismissError}/>;
        }

        if (isStalled) {
            return <OverlayNotice message={STALL_MESSAGE} actionLabel="Close" onAction={onClose}/>;
        }

        if (isProcessing) {
            return (
                <>
                    <HourglassLoadingSpinner/>
                    <span>{PROCESSING_MESSAGE}</span>
                </>
            );
        }

        return null;
    }, [error, isStalled, isProcessing, onDismissError, onClose]);

    if (!content) {
        return null;
    }

    return (
        <div className="iframe-overlay centered-content">
            {content}
        </div>
    );
};
