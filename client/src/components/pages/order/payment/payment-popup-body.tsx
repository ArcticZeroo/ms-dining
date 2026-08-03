import React, { useCallback, useState } from 'react';
import { GenericIFrame } from '../../../iframe/generic-iframe.js';
import { type IPaymentSuccessResult, parseFrameMessage } from '../../../../util/payment-iframe.js';
import { useStallWatchdog } from '../../../../hooks/stall-watchdog.js';
import { PaymentDetailsSkeleton } from './payment-details-skeleton.js';
import { PaymentOverlay } from './payment-overlay.js';

const FRAME_LOAD_TIMEOUT_MS = 15_000;

// The iframe fires one gateway round-trip between submit and a terminal message,
// so a stall isn't instant. If nothing terminal arrives within this window we
// surface an advisory (non-blocking) notice — a real message can still supersede
// it, so we never wrongly abort a slow-but-legitimate flow.
const PAYMENT_STALL_TIMEOUT_MS = 20_000;

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
    const [isProcessing, setIsProcessing] = useState(false);
    const { isStalled, arm: armStallTimer, disarm: disarmStallTimer } = useStallWatchdog(PAYMENT_STALL_TIMEOUT_MS);

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
            setIsProcessing(true);
            armStallTimer();
            return;
        case 'idle':
            setIsProcessing(false);
            disarmStallTimer();
            return;
        case 'error':
            setError(result.message);
            setIsProcessing(false);
            disarmStallTimer();
            return;
        case 'cancel':
            disarmStallTimer();
            onPaymentCancelled();
            return;
        case 'success':
            disarmStallTimer();
            onPaymentSuccess({
                token:    result.token,
                cardInfo: result.cardInfo
            });
            return;
        }
    }, [onPaymentCancelled, onPaymentSuccess, armStallTimer, disarmStallTimer]);

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