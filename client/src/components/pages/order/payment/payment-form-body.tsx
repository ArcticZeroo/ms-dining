import React, { useCallback, useState } from 'react';
import { HourglassLoadingSpinner } from '../../../icon/hourglass-loading-spinner.js';
import { GenericIFrame } from '../../../iframe/generic-iframe.js';
import { type IPaymentSuccessResult, parseFrameMessage } from '../../../../util/payment-iframe.js';

const FRAME_LOAD_TIMEOUT_MS = 15_000;

interface IPaymentFormBodyProps {
    iframeUrl: string;
    onPaymentError: (message: string) => void;
    onPaymentCancelled: () => void;
    onPaymentSuccess: (result: IPaymentSuccessResult) => void;
}

export const PaymentFormBody: React.FC<IPaymentFormBodyProps> = ({
    iframeUrl,
    onPaymentError,
    onPaymentCancelled,
    onPaymentSuccess
}) => {
    const [isLoading, setIsLoading] = useState(true);
    const [iframeError, setIframeError] = useState<string | null>(null);

    const onFrameMessage = useCallback((event: MessageEvent) => {
        if (event.origin !== 'https://pay.rguest.com' && event.origin !== window.location.origin) {
            return;
        }

        const result = parseFrameMessage(event.data);
        if (result.type === 'unknown') {
            console.warn('Unknown postMessage from payment iframe:', event.data);
            return;
        }

        if (result.type === 'error') {
            onPaymentError(result.message);
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
    }, [onPaymentCancelled, onPaymentError, onPaymentSuccess]);

    return (
        <>
            {iframeError && (
                <div className="payment-error">
                    <div>{iframeError}</div>
                    <button className="default-container" onClick={() => setIframeError(null)}>
                        Dismiss
                    </button>
                </div>
            )}
            <div className="iframe-container default-container">
                {isLoading && (
                    <div className="iframe-loading">
                        <HourglassLoadingSpinner/>
                        <span>Loading payment form...</span>
                    </div>
                )}
                <GenericIFrame
                    src={iframeUrl}
                    title="Payment Form"
                    sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
                    loadTimeoutMs={FRAME_LOAD_TIMEOUT_MS}
                    onError={() => setIframeError('Payment form encountered an error. Please refresh the page and try again.')}
                    onLoadTimeout={() => setIframeError('Payment form doesn\'t seem to be loading. Please refresh the page and try again.')}
                    onMessage={onFrameMessage}
                    onLoadComplete={() => setIsLoading(false)}
                />
            </div>
        </>
    );
};