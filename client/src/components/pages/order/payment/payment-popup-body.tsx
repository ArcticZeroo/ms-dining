import React, { useCallback, useState } from 'react';
import { GenericIFrame } from '../../../iframe/generic-iframe.js';
import { type IPaymentSuccessResult, parseFrameMessage } from '../../../../util/payment-iframe.js';
import { usePaymentCoordinationStore } from '../../../../store/zustand/payment-coordination.js';
import { PaymentDetailsSkeleton } from './payment-details-skeleton.js';
import { PaymentOverlay } from './payment-overlay.js';

const FRAME_LOAD_TIMEOUT_MS = 15_000;

const FRAME_ERROR_MESSAGE = 'Payment form encountered an error. Please refresh the page and try again.';
const FRAME_LOAD_TIMEOUT_MESSAGE = 'Payment form doesn\'t seem to be loading. Please refresh the page and try again.';

interface IPaymentFormBodyProps {
    iframeUrl: string;
    onPaymentCancelled: () => void;
    onPaymentSuccess: (result: IPaymentSuccessResult) => void;
}

const isAllowedMessageOrigin = (origin: string) => {
    if (origin === 'https://pay.rguest.com') {
        return true;
    }

    return window.location.hostname === 'localhost' && window.location.origin === origin;
}

export const PaymentPopupBody: React.FC<IPaymentFormBodyProps> = ({
    iframeUrl,
    onPaymentCancelled,
    onPaymentSuccess
}) => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // The modal's phase is owned by the coordination store (the unload/nav guards
    // read it, and it owns the stall timer), so the body just reports transitions.
    const modalState = usePaymentCoordinationStore(state => state.activeModal?.state);
    const markEnteringDetails = usePaymentCoordinationStore(state => state.markEnteringDetails);
    const markSubmitting = usePaymentCoordinationStore(state => state.markSubmitting);
    const markClosing = usePaymentCoordinationStore(state => state.markClosing);

    const onFrameMessage = useCallback((event: MessageEvent) => {
        if (!isAllowedMessageOrigin(event.origin)) {
            return;
        }

        const result = parseFrameMessage(event.data);
        switch (result.type) {
        case 'unknown':
            console.warn('Unknown postMessage from payment iframe:', event);
            return;
        case 'processing':
            markSubmitting();
            return;
        case 'idle':
            markEnteringDetails();
            return;
        case 'error':
            setError(result.message);
            markEnteringDetails();
            return;
        case 'cancel':
            markClosing();
            onPaymentCancelled();
            return;
        case 'success':
            markClosing();
            onPaymentSuccess({
                token:    result.token,
                cardInfo: result.cardInfo
            });
            return;
        }
    }, [onPaymentCancelled, onPaymentSuccess, markSubmitting, markEnteringDetails, markClosing]);

    const isProcessing = modalState?.status === 'submitting';
    const isStalled = modalState?.status === 'submitting' && modalState.isStalled;
    const isOverlayVisible = Boolean(error) || isStalled || isProcessing;

    return (
        <div className="iframe-container default-container">
            {!isOverlayVisible && isLoading && <PaymentDetailsSkeleton/>}
            <PaymentOverlay
                error={error}
                isStalled={isStalled}
                isProcessing={isProcessing}
                onDismissError={() => setError(null)}
            />
            <GenericIFrame
                src={iframeUrl}
                title="Payment Form"
                sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
                loadTimeoutMs={FRAME_LOAD_TIMEOUT_MS}
                onError={() => setError(FRAME_ERROR_MESSAGE)}
                onLoadTimeout={() => setError(FRAME_LOAD_TIMEOUT_MESSAGE)}
                onMessage={onFrameMessage}
                onLoadComplete={() => setIsLoading(false)}
                isVisible={!isLoading}
            />
        </div>
    );
};