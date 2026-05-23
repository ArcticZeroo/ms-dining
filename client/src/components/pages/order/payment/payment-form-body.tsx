import React, { useCallback, useState } from 'react';
import { HourglassLoadingSpinner } from '../../../icon/hourglass-loading-spinner.js';
import { GenericIFrame } from '../../../iframe/generic-iframe.js';
import { type IPaymentSuccessResult, parseFrameMessage } from '../../../../util/payment-iframe.js';

const FRAME_LOAD_TIMEOUT_MS = 15_000;

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

export const PaymentFormBody: React.FC<IPaymentFormBodyProps> = ({
    iframeUrl,
    onPaymentCancelled,
    onPaymentSuccess
}) => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const onFrameMessage = useCallback((event: MessageEvent) => {
        if (!isAllowedMessageOrigin(event.origin)) {
            return;
        }

        const result = parseFrameMessage(event.data);
        if (result.type === 'unknown') {
            console.warn('Unknown postMessage from payment iframe:', event);
            return;
        }

        if (result.type === 'error') {
            setError(result.message);
            return;
        }

        if (result.type === 'cancel') {
            onPaymentCancelled();
            return;
        }

        if (result.type === 'success') {
            onPaymentSuccess({
                token: result.token,
                cardInfo: result.cardInfo
            });
        }

        throw new Error('Unexpected result type - should never be hit');
    }, [onPaymentCancelled, onPaymentSuccess]);

    return (
        <>
            {error && (
                <div className="card error">
                    <div>{error}</div>
                    <button className="default-container" onClick={() => setError(null)}>
                        Dismiss
                    </button>
                </div>
            )}
            {isLoading && (
                <div className="flex flex-center">
                    <HourglassLoadingSpinner/>
                    <span>Loading payment form...</span>
                </div>
            )}
            <div className="iframe-container default-container">
                <GenericIFrame
                    src={iframeUrl}
                    title="Payment Form"
                    sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
                    loadTimeoutMs={FRAME_LOAD_TIMEOUT_MS}
                    onError={() => setError('Payment form encountered an error. Please refresh the page and try again.')}
                    onLoadTimeout={() => setError('Payment form doesn\'t seem to be loading. Please refresh the page and try again.')}
                    onMessage={onFrameMessage}
                    onLoadComplete={() => setIsLoading(false)}
                />
            </div>
        </>
    );
};