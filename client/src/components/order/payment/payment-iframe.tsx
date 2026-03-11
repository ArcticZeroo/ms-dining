import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { IRguestCardInfo } from '@msdining/common/models/cart';
import { z } from 'zod';
import { RetryButton } from '../../button/retry-button.tsx';

import './payment-iframe.css';

export interface IRguestPaymentResult {
    token: string;
    cardInfo: IRguestCardInfo;
}

export interface IPaymentIframeProps {
    iframeUrl: string;
    onPaymentComplete: (result: IRguestPaymentResult) => Promise<void>;
    onPaymentError: (error: string) => void;
    onClose: () => void;
}

const IFRAME_LOAD_TIMEOUT_MS = 15_000;

const rguestCardInfoSchema = z.object({
    cardIssuer:          z.string(),
    accountNumberMasked: z.string(),
    expirationYearMonth: z.string(),
    cardholderName:      z.string(),
    postalCode:          z.string(),
}).passthrough();

const rguestPaymentSuccessSchema = z.object({
    token: z.string().optional(),
    transactionReferenceData: z.object({
        token: z.string(),
    }).optional(),
    cardInfo: rguestCardInfoSchema.optional(),
    gatewayResponseData: z.object({
        decision: z.string(),
        message:  z.string().optional(),
    }).optional(),
});

const rguestPaymentErrorSchema = z.object({
    code:    z.number(),
    reason:  z.string().optional(),
    message: z.string().optional(),
});

const rguestCancelSchema = z.object({
    cancel: z.literal(true),
});

const tryParseJson = (value: string): unknown => {
    try {
        return JSON.parse(value);
    } catch {
        return undefined;
    }
};

export const PaymentIframe: React.FC<IPaymentIframeProps> = ({ iframeUrl, onPaymentComplete, onPaymentError, onClose }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [iframeError, setIframeError] = useState<string | null>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const lastPaymentResultRef = useRef<IRguestPaymentResult | null>(null);

    const { stage: completionStage, error: completionError, run: runCompletion } = useDelayedPromiseState(
        useCallback(async () => {
            const result = lastPaymentResultRef.current;
            if (!result) {
                throw new Error('No payment result');
            }
            await onPaymentComplete(result);
        }, [onPaymentComplete])
    );

    const handleMessage = useCallback((event: MessageEvent) => {
        if (event.origin !== 'https://pay.rguest.com') {
            return;
        }

        const data = event.data;

        // null or empty string — no token / duplicate submit; ignore
        if (data === null || data === '') {
            return;
        }

        // String — AJAX error, data.responseText was posted as raw string
        if (typeof data === 'string' && data !== '') {
            const parsed = rguestPaymentErrorSchema.safeParse(tryParseJson(data));
            if (parsed.success) {
                const message = parsed.data.message ?? parsed.data.reason ?? 'Payment error';
                setIframeError(message);
                onPaymentError(message);
            } else {
                setIframeError(data);
                onPaymentError(data);
            }
            return;
        }

        // Cancel flag
        const cancelResult = rguestCancelSchema.safeParse(data);
        if (cancelResult.success) {
            onClose();
            return;
        }

        // Success — has token or transactionReferenceData
        const successResult = rguestPaymentSuccessSchema.safeParse(data);
        if (successResult.success) {
            const decision = successResult.data.gatewayResponseData?.decision;
            if (decision && decision !== 'ACCEPT') {
                const reason = successResult.data.gatewayResponseData?.message ?? decision;
                const message = `Payment declined: ${reason}`;
                setIframeError(message);
                onPaymentError(message);
                return;
            }

            const token = successResult.data.token ?? successResult.data.transactionReferenceData?.token;
            if (token) {
                const cardInfo: IRguestCardInfo = {
                    accountNumberMasked: successResult.data.cardInfo?.accountNumberMasked ?? '',
                    cardIssuer:          successResult.data.cardInfo?.cardIssuer ?? '',
                    expirationYearMonth: successResult.data.cardInfo?.expirationYearMonth ?? '',
                    cardHolderName:      successResult.data.cardInfo?.cardholderName ?? '',
                    postalCode:          successResult.data.cardInfo?.postalCode ?? '',
                };

                lastPaymentResultRef.current = { token, cardInfo };
                runCompletion();
                return;
            }
        }

        // 3DS failure or other error object — fall through to unknown message warning
        console.warn('Unknown postMessage from rguest iframe:', data);
    }, [runCompletion, onPaymentError, onClose]);

    useEffect(() => {
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [handleMessage]);

    useEffect(() => {
        loadTimeoutRef.current = setTimeout(() => {
            setIsLoading(false);
            setIframeError('Payment form took too long to load. Please try again.');
        }, IFRAME_LOAD_TIMEOUT_MS);

        return () => {
            if (loadTimeoutRef.current) {
                clearTimeout(loadTimeoutRef.current);
            }
        };
    }, []);

    const onIframeLoad = useCallback(() => {
        setIsLoading(false);
        if (loadTimeoutRef.current) {
            clearTimeout(loadTimeoutRef.current);
        }
    }, []);

    const onIframeError = useCallback(() => {
        setIsLoading(false);
        if (loadTimeoutRef.current) {
            clearTimeout(loadTimeoutRef.current);
        }
        setIframeError('Failed to load payment form. Please try again.');
    }, []);

    if (completionStage !== PromiseStage.notRun) {
        const errorMessage = completionStage === PromiseStage.error
            ? (completionError instanceof Error ? completionError.message : 'Failed to complete order')
            : null;

        return (
            <div className="payment-popup card">
                <div className="popup-header">
                    <span className="popup-title">Processing Payment</span>
                    {errorMessage && (
                        <button className="close-button" onClick={onClose} title="Close">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    )}
                </div>
                {errorMessage ? (
                    <div className="payment-error">
                        <div>{errorMessage}</div>
                        <RetryButton onClick={runCompletion}/>
                    </div>
                ) : (
                    <div className="payment-completing">
                        <span className="material-symbols-outlined">hourglass_top</span>
                        <span>Processing payment...</span>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="payment-popup card">
            <div className="popup-header">
                <span className="popup-title">Enter Payment Details</span>
                <button className="close-button" onClick={onClose} title="Close">
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>
            {iframeError && (
                <div className="payment-error">
                    <div>{iframeError}</div>
                    <button className="default-container" onClick={() => setIframeError(null)}>
                        Dismiss
                    </button>
                </div>
            )}
            <div className="iframe-container">
                {isLoading && (
                    <div className="iframe-loading">
                        <span className="material-symbols-outlined">hourglass_top</span>
                        <span>Loading payment form...</span>
                    </div>
                )}
                <iframe
                    ref={iframeRef}
                    src={iframeUrl}
                    onLoad={onIframeLoad}
                    onError={onIframeError}
                    title="Payment Form"
                    sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
                />
            </div>
        </div>
    );
};
