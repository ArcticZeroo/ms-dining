import React, { useCallback, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { IPaymentCardInfo } from '@msdining/common/models/cart';
import { z } from 'zod';
import { RetryButton } from '../../../button/retry-button.tsx';
import { HourglassLoadingSpinner } from '../../../icon/hourglass-loading-spinner.tsx';
import { getErrorMessage } from '../../../../util/mutation.js';
import { GenericIFrame } from '../../../iframe/generic-iframe.js';
import { Modal } from '../../../popup/modal.tsx';

import './payment-iframe.css';

export interface FramePaymentResult {
    token: string;
    cardInfo: IPaymentCardInfo;
}

export interface IPaymentIframeProps {
    iframeUrl: string;
    onPaymentComplete: (result: FramePaymentResult) => Promise<void>;
    onPaymentError: (error: string) => void;
    onClose: () => void;
}

const FRAME_LOAD_TIMEOUT_MS = 15_000;

const FrameCardInfoSchema = z.object({
    cardIssuer:          z.string(),
    accountNumberMasked: z.string(),
    expirationYearMonth: z.string(),
    cardholderName:      z.string(),
    postalCode:          z.string(),
}).passthrough();

const FrameCompletionMessageSchema = z.object({
    token:                    z.string().optional(),
    transactionReferenceData: z.object({
        token: z.string(),
    }).optional(),
    cardInfo:                 FrameCardInfoSchema.optional(),
    gatewayResponseData:      z.object({
        decision: z.string(),
        message:  z.string().optional(),
    }).optional(),
});

const FrameErrorSchema = z.object({
    code:    z.number(),
    reason:  z.string().optional(),
    message: z.string().optional(),
});

const FrameCancelSchema = z.object({
    cancel: z.literal(true),
});

const tryParseJson = (value: string): unknown => {
    try {
        return JSON.parse(value);
    } catch {
        return undefined;
    }
};

interface IPaymentFrameMessageSuccess {
    type: 'success';
    token: string;
    cardInfo: IPaymentCardInfo;
}

interface IPaymentFrameMessageCancelled {
    type: 'cancel';
}

interface IPaymentFrameMessageFailure {
    type: 'error';
    message: string;
}

interface IPaymentFrameMessageUnknown {
    type: 'unknown';
}

type PaymentFrameMessage =
    IPaymentFrameMessageSuccess
    | IPaymentFrameMessageCancelled
    | IPaymentFrameMessageFailure
    | IPaymentFrameMessageUnknown;

const parseFrameErrorString = (data: string): PaymentFrameMessage => {
    const frameErrorParseResult = FrameErrorSchema.safeParse(tryParseJson(data));
    if (frameErrorParseResult.success) {
        const frameError = frameErrorParseResult.data;
        return {
            type: 'error',
            message: frameError.message ?? frameError.reason ?? 'Payment error'
        };
    }

    return {
        type: 'error',
        message: data
    }
}

const isFrameUserCancellationMessage = (data: unknown) => {
    return FrameCancelSchema.safeParse(data).success;
}

const tryParseFrameCompletionMessage = (data: unknown): PaymentFrameMessage | undefined => {
    const frameMessageParseResult = FrameCompletionMessageSchema.safeParse(data);
    if (!frameMessageParseResult.success) {
        return undefined;
    }

    const decision = frameMessageParseResult.data.gatewayResponseData?.decision;
    if (decision && decision !== 'ACCEPT') {
        const reason = frameMessageParseResult.data.gatewayResponseData?.message ?? decision;
        return {
            type: 'error',
            message: `Payment declined: ${reason}`,
        };
    }

    const token = frameMessageParseResult.data.token ?? frameMessageParseResult.data.transactionReferenceData?.token;
    if (token) {
        return {
            type: 'success',
            cardInfo: {
                accountNumberMasked: frameMessageParseResult.data.cardInfo?.accountNumberMasked ?? '',
                cardIssuer:          frameMessageParseResult.data.cardInfo?.cardIssuer ?? '',
                expirationYearMonth: frameMessageParseResult.data.cardInfo?.expirationYearMonth ?? '',
                cardHolderName:      frameMessageParseResult.data.cardInfo?.cardholderName ?? '',
                postalCode:          frameMessageParseResult.data.cardInfo?.postalCode ?? '',
            },
            token,
        };
    }
}

const parseFrameMessage = (data: unknown): PaymentFrameMessage => {
    if (!data) {
        return { type: 'unknown' };
    }

    if (typeof data === 'string') {
        return parseFrameErrorString(data);
    }

    if (isFrameUserCancellationMessage(data)) {
        return { type: 'cancel' };
    }

    return tryParseFrameCompletionMessage(data) ?? { type: 'unknown' };
}

// ─── Sub-components ──────────────────────────────────────────────────

interface IPaymentFormBodyProps {
    iframeUrl: string;
    iframeError: string | null;
    isLoading: boolean;
    onFrameMessage: (event: MessageEvent) => void;
    onDismissError: () => void;
    onLoadComplete: () => void;
    onFrameTimeout: () => void;
    onFrameError: () => void;
}

const PaymentFormBody: React.FC<IPaymentFormBodyProps> = ({
    iframeUrl,
    iframeError,
    isLoading,
    onFrameMessage,
    onDismissError,
    onLoadComplete,
    onFrameTimeout,
    onFrameError,
}) => (
    <>
        {iframeError && (
            <div className="payment-error">
                <div>{iframeError}</div>
                <button className="default-container" onClick={onDismissError}>
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
                onError={onFrameError}
                onLoadTimeout={onFrameTimeout}
                onMessage={onFrameMessage}
                onLoadComplete={onLoadComplete}
            />
        </div>
    </>
);

interface IPaymentCompletionBodyProps {
    errorMessage: string | null;
    onRetry: () => void;
}

const PaymentCompletionBody: React.FC<IPaymentCompletionBodyProps> = ({ errorMessage, onRetry }) => {
    if (errorMessage) {
        return (
            <div className="payment-error">
                <div>{errorMessage}</div>
                <RetryButton onClick={onRetry}/>
            </div>
        );
    }

    return (
        <div className="payment-completing">
            <HourglassLoadingSpinner/>
            <span>Processing payment...</span>
        </div>
    );
};

// ─── Main component ──────────────────────────────────────────────────

export const PaymentIframe: React.FC<IPaymentIframeProps> = ({ iframeUrl, onPaymentComplete, onPaymentError, onClose }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [iframeError, setIframeError] = useState<string | null>(null);
    const lastPaymentResultRef = useRef<FramePaymentResult | null>(null);

    const orderCompletionState = useMutation<void, Error, FramePaymentResult>({
        mutationFn: (result) => onPaymentComplete(result),
    });
    const { mutate: runCompletion } = orderCompletionState;

    const retryCompletion = useCallback(() => {
        const result = lastPaymentResultRef.current;
        if (result) {
            runCompletion(result);
        }
    }, [runCompletion]);

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
            setIframeError(result.message);
            onPaymentError(result.message);
            return;
        }

        if (result.type === 'cancel') {
            onClose();
            return;
        }

        const { token, cardInfo } = result;
        lastPaymentResultRef.current = { token, cardInfo };
        runCompletion({ token, cardInfo });
    }, [runCompletion, onPaymentError, onClose]);

    const onFrameTimeout = () => {
        setIframeError('Payment form doesn\'t seem to be loading. Please refresh the page and try again.');
    }

    const onFrameError = () => {
        setIframeError('Payment form encountered an error. Please refresh the page and try again.');
    };

    if (orderCompletionState.isIdle) {
        return (
            <Modal
                title="Enter Payment Details"
                body={
                    <PaymentFormBody
                        iframeUrl={iframeUrl}
                        iframeError={iframeError}
                        isLoading={isLoading}
                        onFrameMessage={onFrameMessage}
                        onDismissError={() => setIframeError(null)}
                        onLoadComplete={() => setIsLoading(false)}
                        onFrameTimeout={onFrameTimeout}
                        onFrameError={onFrameError}
                    />
                }
            />
        );
    }

    const completionErrorMessage = orderCompletionState.isError
        ? getErrorMessage(orderCompletionState.error, 'Failed to complete order')
        : null;

    return (
        <Modal
            title="Processing Payment"
            body={
                <PaymentCompletionBody
                    errorMessage={completionErrorMessage}
                    onRetry={retryCompletion}
                />
            }
        />
    );
};
